import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import {
  Search, HelpCircle, ChevronDown, ChevronRight,
  Settings, Play, Download, Captions, Tv, Radio, Globe,
  Palette, Users, Shield, FolderOpen, HardDrive, Server,
  Key, Gauge, Puzzle, Bell, BarChart3, MessageSquare,
  Lock, Cog, Database, Zap, Volume2, Maximize, History,
  FastForward, SkipForward, Clock, Package
} from 'lucide-react';
import { Input } from '../components/ui/input';

const HELP_SECTIONS = [
  {
    category: 'General',
    icon: Settings,
    color: 'text-gray-400',
    items: [
      { title: 'Storage Paths', description: 'Configure where WatchNexus stores your media files. The download path is used for temporary storage during downloads, and the library path is where your organized media collection lives.', examples: ['Download Path: /media/downloads or D:\\Downloads\\WatchNexus', 'Library Path: /media/library or D:\\Media\\Library', 'Ensure the paths exist and the application has read/write access'] },
      { title: 'Download Path', description: 'The folder where media is temporarily stored while downloading. Files are moved to the library path after processing is complete.', examples: ['Linux: /media/downloads', 'Windows: D:\\Downloads\\WatchNexus'] },
      { title: 'Library Path', description: 'The main folder where your organized media collection is stored. WatchNexus scans this directory to populate your library with movies, TV shows, and other media.', examples: ['Linux: /media/library', 'Windows: D:\\Media\\Library', 'Network: /mnt/nas/media'] },
      { title: 'Quality Preference', description: 'Sets the default video quality for downloads and streaming. Higher quality means larger file sizes and more bandwidth usage.', examples: ['4K (2160p): Best quality, ~20-60 GB per movie', '1080p: Great quality, ~5-15 GB per movie', '720p: Good quality, ~2-5 GB per movie', '480p: Standard, ~1-2 GB per movie'] },
      { title: 'Sidebar Visibility', description: 'Control which navigation items appear in your sidebar. Toggle items on or off to customize your experience. Home, Downloads, and Settings are always visible and cannot be hidden.', examples: ['Click a tab to toggle its visibility', "Use 'Show All' to enable everything at once", 'Changes sync to your account across all devices'] },
      { title: 'Display Preferences', description: 'Customize how media information is displayed throughout the application. These settings affect all pages and views.', examples: ['Enable ratings to see TMDB scores on cards', 'Compact mode reduces card sizes for more items per row', '24-hour time shows 14:30 instead of 2:30 PM'] },
      { title: 'Notification Preferences', description: 'Control which events trigger in-app notifications. For external notification channels (Discord, email, webhooks), visit the Notifications page.', examples: ["Enable 'Download Complete' to be notified when a download finishes", "Enable 'New Episodes' to know when tracked shows release new episodes"] },
    ]
  },
  {
    category: 'Playback',
    icon: Play,
    color: 'text-green-400',
    items: [
      { title: 'Skip Intro & Credits', description: 'Automatically detects and skips TV show intros, credits, and recaps. When enabled, a Skip button appears during intro/credit segments, or they can be skipped automatically.', examples: ['Auto-skip intros: Jumps past opening credits automatically', 'Skip credits: Skips end credits and goes to next episode', "Skip recaps: Skips 'previously on...' segments"] },
      { title: 'Default Segment Timings', description: "Fallback timings used when Chromaprint audio fingerprinting can't detect intro/credit boundaries. Set approximate start/end times in seconds for typical intros and credits.", examples: ['Intro start: Usually 0-5 seconds into the episode', 'Intro end: Most TV intros are 30-90 seconds', 'Credits start: Usually begins 1-3 minutes before the end'] },
      { title: 'Auto-Play Next Episode', description: 'Automatically starts playing the next episode in a series when the current one ends. A countdown timer gives you a chance to cancel before the next episode starts.', examples: ['Set countdown to 5-10 seconds for a comfortable buffer', 'Disable for movies — this mainly applies to TV series', 'Works with watched/unwatched tracking'] },
      { title: 'Chromaprint Intro Detection', description: 'Uses audio fingerprinting technology to automatically detect intro and credit segments by analyzing audio patterns across episodes. Requires the Chromaprint library to be installed on the server.', examples: ['Status shows if Chromaprint is installed and working', 'Once enabled, WatchNexus analyzes episodes in the background', 'Results are cached so detection only runs once per episode'] },
      { title: 'Audio Settings', description: 'Configure default audio playback behavior including volume level, preferred language track, and audio normalization.', examples: ['Default volume: Set to 80-100 for typical use', 'Audio language: Choose your preferred language for multi-track media', 'Audio normalization: Evens out loud and quiet parts'] },
      { title: 'Display Options', description: 'Control how the video player renders content including subtitle appearance, default fullscreen behavior, and aspect ratio handling.', examples: ['Default subtitle size: Adjust for your screen distance', 'Auto-fullscreen: Automatically enter fullscreen when playback starts', "Aspect ratio: Keep 'Auto' to preserve the original video ratio"] },
      { title: 'Watch History', description: "View and manage your watch history. This tracks every movie and episode you've watched, including progress. You can clear individual items or wipe the entire history.", examples: ['Click an item to resume watching from where you left off', 'Use the trash icon to remove individual entries', "'Clear All' permanently deletes your entire watch history"] },
    ]
  },
  {
    category: 'Downloads',
    icon: Download,
    color: 'text-blue-400',
    items: [
      { title: 'Download Client', description: 'Choose which torrent client WatchNexus uses to download media. The built-in engine requires no external software. qBittorrent requires a separate installation but offers more advanced features.', examples: ['Built-in: Zero setup, works out of the box, recommended for most users', 'qBittorrent: Install from qbittorrent.org, enable Web UI in settings', 'Only one client can be active at a time'] },
      { title: 'Speed Limits', description: 'Control how much bandwidth the torrent engine uses. Set limits to prevent WatchNexus from saturating your internet connection.', examples: ['Set download limit to 80% of your connection speed', 'Upload limit of 0 = unlimited seeding', 'Seed ratio of 1.0 means upload as much as you download'] },
      { title: 'qBittorrent Connection', description: 'Connect to an external qBittorrent instance running on your network. You must have qBittorrent installed and its Web UI enabled.', examples: ['URL: http://localhost:8080 (default qBittorrent Web UI)', "Username/Password: Set in qBittorrent's Web UI settings", 'Test the connection after entering your details'] },
    ]
  },
  {
    category: 'Subtitles',
    icon: Captions,
    color: 'text-green-400',
    items: [
      { title: 'Subtitle Settings (Garnish)', description: 'Configure automatic subtitle downloading from multiple providers. Set your preferred languages and providers will be searched in priority order. Supports OpenSubtitles, Addic7ed, Subscene, and more.', examples: ['Add your preferred languages in order of priority', 'OpenSubtitles requires a free API key from opensubtitles.com', 'Enable auto-download to fetch subtitles when media is added'] },
    ]
  },
  {
    category: 'Streaming Services',
    icon: Tv,
    color: 'text-indigo-400',
    items: [
      { title: 'Streaming Services (Cream)', description: 'Store login credentials for your streaming service subscriptions (Netflix, Disney+, etc.). These are used for tracking availability and can be shared with household members through WatchNexus.', examples: ['Add your Netflix, Hulu, or Disney+ credentials', 'Credentials are stored encrypted on your server', 'Share access with other WatchNexus users in your household'] },
    ]
  },
  {
    category: 'IPTV & Live TV',
    icon: Radio,
    color: 'text-pink-400',
    items: [
      { title: 'IPTV Configuration', description: "Set up live TV by adding M3U playlist sources and EPG (Electronic Program Guide) data. Configure recording options for DVR functionality. Supports standard IPTV providers and custom M3U playlists.", examples: ["M3U Source: Paste your IPTV provider's M3U playlist URL", 'EPG: Add an XMLTV guide URL for program listings', 'DVR: Record live TV to your library path'] },
    ]
  },
  {
    category: 'Integrations & API Keys',
    icon: Key,
    color: 'text-amber-400',
    items: [
      { title: 'Integrations', description: 'Connect WatchNexus to external services for metadata, artwork, and media information. TMDB provides movie/TV data, and Matrix enables federated chat functionality.', examples: ['TMDB: Get a free API key at themoviedb.org/settings/api', 'Matrix: Connect to a Matrix homeserver for social features', 'API keys are stored securely on your server'] },
      { title: 'API Management (Crumbs)', description: 'Manage API keys and credentials for external services that WatchNexus integrates with. Each service requires its own API key to function.', examples: ['TMDB: Required for movie/TV metadata. Get a free key at themoviedb.org', 'OpenSubtitles: Required for subtitle downloads. Register at opensubtitles.com', 'Click a service to configure its API key'] },
    ]
  },
  {
    category: 'External Access',
    icon: Globe,
    color: 'text-cyan-400',
    items: [
      { title: 'External Access (Gelatin)', description: 'Securely access your WatchNexus server from outside your home network. Create tunnels for remote access and generate share links for individual media items.', examples: ['Tunnel: Creates a secure connection from the internet to your server', 'Share Link: Generate a temporary link to share a specific movie or show', 'Custom Domain: Point your own domain to your WatchNexus instance'] },
    ]
  },
  {
    category: 'Appearance',
    icon: Palette,
    color: 'text-purple-400',
    items: [
      { title: 'Theme Forge (Milk)', description: 'Personalize the look and feel of WatchNexus. Switch between dark and light modes, choose from community-created themes, or customize accent colors to match your style.', examples: ['Dark Mode: Best for home theater and low-light environments', 'Light Mode: Better readability in bright rooms', 'Community themes: Browse and install themes from other users'] },
    ]
  },
  {
    category: 'Users & Security',
    icon: Users,
    color: 'text-blue-400',
    items: [
      { title: 'Users & Access', description: "Manage who can access your WatchNexus server. Create accounts for household members, assign roles (admin or user), and control what each person can see and do.", examples: ["Admin: Full access to all settings, users, and media management", "User: Can browse, play, and request media but can't change settings", 'Invite codes: Generate one-time codes for new users to register'] },
    ]
  },
  {
    category: 'Media Libraries',
    icon: FolderOpen,
    color: 'text-violet-400',
    items: [
      { title: 'Media Libraries (Marmalade)', description: 'Add and manage folders containing your media files. WatchNexus scans these directories to discover movies, TV shows, music, and other media. Each library is configured for a specific media type.', examples: ['Movies: Point to a folder like /media/movies or D:\\Movies', 'TV Shows: Point to a folder organized by series name', 'Scan: Click the refresh icon to re-scan a library for new files', 'Metadata: WatchNexus auto-fetches posters, descriptions, and ratings'] },
      { title: 'Media Health Checker', description: 'Scans your media library for corrupted, incomplete, or problematic files. Identifies issues like truncated downloads, missing audio streams, or unplayable formats.', examples: ['Enter the path to scan, e.g., /media/movies or D:\\Media', 'Results show file integrity status for each item', 'Use filters to view only items with issues'] },
      { title: 'Quality Profiles (Preserve)', description: 'Define which video/audio qualities are acceptable for downloads. Set minimum and maximum quality thresholds and preferred formats.', examples: ['HD Profile: Allows 720p-1080p, prefers Bluray sources', '4K Profile: Allows 2160p only, requires HDR', 'Any Profile: Accepts all qualities, upgrades when better available', 'Drag to reorder priority — top items are preferred'] },
    ]
  },
  {
    category: 'Indexers',
    icon: Server,
    color: 'text-violet-400',
    items: [
      { title: 'Indexers (Compote)', description: 'Indexers are search providers that WatchNexus queries to find torrent and NZB releases. Add Torznab-compatible indexers like Jackett, Prowlarr, or direct sites.', examples: ['Jackett: Install from github.com/Jackett/Jackett, add its Torznab URL', 'Prowlarr: Install from prowlarr.com, add indexers there and connect here', 'RSS: Add RSS feed URLs for automatic new release monitoring'] },
    ]
  },
  {
    category: 'System & Maintenance',
    icon: Shield,
    color: 'text-orange-400',
    items: [
      { title: 'System Maintenance', description: 'Monitor server health, view resource usage, manage the database, and view application logs. Use this section to troubleshoot issues and keep your server running smoothly.', examples: ['System: CPU, RAM, and disk usage at a glance', 'Database: Check SQLite health, size, and run optimizations', 'Logs: View application logs to diagnose issues'] },
      { title: 'Gadgets', description: 'Gadgets are modular features that extend WatchNexus functionality. Browse the marketplace to discover new gadgets, or manage your installed ones.', examples: ['Install a gadget from the marketplace to add new features', 'Deactivate a gadget to temporarily disable it without removing data', 'Uninstall removes the gadget and its associated settings'] },
    ]
  },
  {
    category: 'Gadget Pages',
    icon: Puzzle,
    color: 'text-violet-400',
    items: [
      { title: 'Weather', description: 'View weather forecasts for your location. Search for cities and save your preferred location. Supports Celsius and Fahrenheit units.', examples: ['Search for a city name to find weather data', 'Save a location as your default in Weather settings', 'Weather data is sourced from Open-Meteo (no API key needed)'] },
      { title: 'Podcasts', description: 'Search for podcasts, subscribe to your favorites, and browse episodes. Uses the iTunes Search API and PodcastIndex.org for discovery.', examples: ['Search by podcast name or topic', 'Subscribe to add a podcast to your library', 'Click an episode to view details or play'] },
      { title: 'Radio', description: 'Browse and listen to internet radio stations from around the world. Search by name, country, or genre. Powered by the radio-browser.info community database.', examples: ['Search for stations by name like "BBC Radio" or "Jazz FM"', 'Browse by country or genre tags', 'Save favorites for quick access'] },
      { title: 'Analytics (Truffle)', description: 'View your watch statistics including total plays, watch hours, top genres, and recent activity. Filter by time period (7, 30, or 90 days).', examples: ['See how many hours of content you have watched', 'Discover your most-watched genres', 'Track viewing trends over time'] },
      { title: 'Notifications (Pepper)', description: 'Manage notification channels and view notification history. Supports webhooks, email, Discord, and Pushover.', examples: ['Add a Discord webhook URL to get notifications in your server', 'Test a channel to verify it is configured correctly', 'View history of all sent notifications'] },
      { title: 'Requests (Meringue)', description: 'Submit and track media requests. Users can request movies or shows they want added to the library. Admins can approve, reject, or fulfill requests.', examples: ['Click New Request and enter the title of the media you want', 'Track the status of your requests (pending, approved, fulfilled)', 'Admins see all user requests and can manage them'] },
      { title: 'Parental Controls (Rind)', description: 'Configure content restrictions including PIN protection, maximum content rating, and genre blocking. Protects younger viewers from inappropriate content.', examples: ['Set a 4-digit PIN required to access restricted content', 'Set max rating to PG-13 to hide R-rated and above', 'Block genres like Horror or Violence'] },
      { title: 'Processing (Crucible)', description: 'Submit and monitor media transcode jobs. Convert media between formats (MP4, MKV, WebM) with configurable quality presets. Requires FFmpeg installed on the server.', examples: ['Convert MKV files to MP4 for wider device compatibility', 'Use "slow" preset for best quality, "ultrafast" for speed', 'Monitor job progress in real-time'] },
      { title: 'Usenet (Brine + Ladle)', description: 'Search Usenet indexers and manage NZB downloads. Brine connects to Prowlarr-compatible indexers, Ladle connects to SABnzbd for downloading.', examples: ['Configure your Prowlarr URL and API key in the Indexer section', 'Configure your SABnzbd URL and API key in the Downloader section', 'Search for releases and click Grab to start downloading'] },
    ]
  },
];

const HelpPage = () => {
  const [query, setQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState(new Set(HELP_SECTIONS.map(s => s.category)));
  const [expandedItems, setExpandedItems] = useState(new Set());

  const filtered = useMemo(() => {
    if (!query.trim()) return HELP_SECTIONS;
    const q = query.toLowerCase();
    return HELP_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.examples || []).some(e => e.toLowerCase().includes(q))
      )
    })).filter(section => section.items.length > 0);
  }, [query]);

  const totalItems = HELP_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);

  const toggleCat = (cat) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleItem = (key) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="help-page">
        <div className="text-center space-y-3 pt-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
            <HelpCircle className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Help & Documentation</h1>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            Everything you need to know about WatchNexus. Search for a topic or browse by category.
            <span className="text-gray-500 ml-1">({totalItems} topics)</span>
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <Input
            placeholder="Search help topics... (e.g., subtitles, TMDB, quality)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-11 h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            data-testid="help-search-input"
          />
          {query && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              {filtered.reduce((s, sec) => s + sec.items.length, 0)} result(s) for "{query}"
            </p>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {filtered.map(section => (
            <motion.div
              key={section.category}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleCat(section.category)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                data-testid={`help-cat-${section.category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                    <section.icon className={`w-4.5 h-4.5 ${section.color}`} />
                  </div>
                  <div>
                    <span className="text-white font-semibold text-sm">{section.category}</span>
                    <span className="text-gray-500 text-xs ml-2">({section.items.length})</span>
                  </div>
                </div>
                {expandedCats.has(section.category) ?
                  <ChevronDown className="w-4 h-4 text-gray-500" /> :
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                }
              </button>

              <AnimatePresence>
                {expandedCats.has(section.category) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/5"
                  >
                    {section.items.map((item, idx) => {
                      const key = `${section.category}-${idx}`;
                      const isOpen = expandedItems.has(key);
                      return (
                        <div key={key} className="border-b border-white/5 last:border-0">
                          <button
                            onClick={() => toggleItem(key)}
                            className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors text-left"
                            data-testid={`help-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <span className="text-gray-200 text-sm font-medium">{item.title}</span>
                            {isOpen ?
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> :
                              <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            }
                          </button>
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="px-5 pb-4"
                              >
                                <p className="text-gray-400 text-xs leading-relaxed mb-3">{item.description}</p>
                                {item.examples && item.examples.length > 0 && (
                                  <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Examples & Tips</p>
                                    <ul className="space-y-1.5">
                                      {item.examples.map((ex, i) => (
                                        <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                                          <span className="text-violet-400 mt-0.5 flex-shrink-0">&#8227;</span>
                                          <span>{ex}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="glass-card rounded-xl p-12 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500">No results found for "{query}"</p>
              <p className="text-gray-600 text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default HelpPage;
