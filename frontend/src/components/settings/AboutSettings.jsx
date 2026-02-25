import { useState, useEffect } from 'react';
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

// Release history
const RELEASES = [
  {
    version: '2.5.9', date: '2025-02-25', type: 'minor', title: 'Watch History Management',
    highlights: ['X button on Continue Watching cards', 'Watch History tab in Playback Settings', 'Clear all history with confirmation dialog'],
    changes: [
      { type: 'feature', text: 'Added X button (top-right) on Continue Watching cards to remove items' },
      { type: 'feature', text: 'New "Watch History" tab in Playback Settings' },
      { type: 'feature', text: 'Clear individual items or entire watch history' },
      { type: 'feature', text: 'Confirmation dialog with warning before clearing all history (like Crunchyroll)' },
      { type: 'feature', text: 'Backend API: DELETE /watch-progress and /watch-progress/all endpoints' },
      { type: 'fix', text: 'Fixed server.py to include uvicorn startup for standalone execution' },
    ]
  },
  {
    version: '2.5.8', date: '2025-02-25', type: 'minor', title: 'Settings UX Overhaul - Tabbed Navigation',
    highlights: ['Tabbed submenus for ALL Settings pages', 'Consistent UI across entire Settings section', 'Improved navigation and discoverability'],
    changes: [
      { type: 'feature', text: 'General Settings: Paths & Storage | Sidebar Tabs | Preferences' },
      { type: 'feature', text: 'Playback Settings: Skip Intro/Credits | Auto-Play | Detection Engine | Player Options' },
      { type: 'feature', text: 'Users & Access: User Management | Access & API | Activity Log' },
      { type: 'feature', text: 'IPTV: IPTV Sources | EPG Guide | Recording' },
      { type: 'feature', text: 'Streaming Services: Service Logins | Deep Links | Watch Tracking' },
      { type: 'feature', text: 'Theme Forge: Light/Dark Mode | Theme Presets | Custom Theme' },
      { type: 'feature', text: 'External Access (Gelatin): Server Status | Network Tunnels | Access Tokens' },
      { type: 'feature', text: 'Maintenance: System Status | Database | Cache & Services | Server Logs' },
      { type: 'feature', text: 'Subtitles (Garnish): Providers | Languages | Preferences' },
      { type: 'improvement', text: 'Reusable SettingsTabHeader component for consistent styling' },
    ]
  },
  {
    version: '2.5.7', date: '2025-02-25', type: 'patch', title: 'Scaffolding Cleanup & Legal Compliance',
    highlights: ['Removed dummy gadget pages', 'Added Legal & Trademarks section', 'Gadget compatibility UI'],
    changes: [
      { type: 'improvement', text: 'Removed non-functional gadget pages (Radio, Photos, Podcasts, WebVideo)' },
      { type: 'feature', text: 'Unsupported gadgets now show "Coming Soon" badge instead of Install button' },
      { type: 'feature', text: 'Added comprehensive Legal & Trademarks section with trademark notices' },
      { type: 'fix', text: 'Replaced fake logo icons with generic TV icons for streaming services' },
    ]
  },
  {
    version: '2.5.6', date: '2025-02-25', type: 'minor', title: 'Gadgets Catalogue & Library Overhaul',
    highlights: ['Gadgets Catalogue with 45 extensions', 'Movies & TV Shows now show local library', 'Anime as distinct media category', '12 release packages'],
    changes: [
      { type: 'feature', text: 'Gadgets Catalogue: 45 built-in extensions across 16 categories' },
      { type: 'feature', text: 'Movies page: Dual Library/Discover view showing local media + TMDB discovery' },
      { type: 'feature', text: 'TV Shows page: Dual Library/Discover view with automatic series grouping' },
      { type: 'feature', text: 'Anime page: Fully distinct category with dedicated library support' },
      { type: 'improvement', text: 'Renamed "Plugins" to "Gadgets" throughout the application' },
    ]
  },
  {
    version: '2.5.5', date: '2025-02-24', type: 'minor', title: 'Theming, Security & Code Audit',
    highlights: ['Complete theming system overhaul', 'Critical security patch', 'Credits section added'],
    changes: [
      { type: 'feature', text: 'Full light/dark mode system with user-selectable color themes' },
      { type: 'security', text: 'Patched unauthenticated media streaming endpoint' },
      { type: 'fix', text: 'Fixed CSS variable mismatches causing invisible UI elements' },
    ]
  },
  {
    version: '2.5.0', date: '2025-02-22', type: 'major', title: 'Multi-Platform Client Release',
    highlights: ['Client apps for 5 platforms', 'System tray application', 'Auto-updater system'],
    changes: [
      { type: 'feature', text: 'Android, Android TV, Fire TV, Roku, and Kodi clients' },
      { type: 'feature', text: 'Beacon system tray app for server management' },
      { type: 'feature', text: 'Tiramisu auto-updater for seamless version updates' },
    ]
  },
  {
    version: '2.0.0', date: '2025-02-14', type: 'major', title: 'Major Architecture Update',
    highlights: ['Complete UI/UX redesign', 'New plugin architecture', 'Quality profiles system'],
    changes: [
      { type: 'feature', text: 'New dark theme with glass-morphism design' },
      { type: 'feature', text: 'Quality profiles for downloads (like Sonarr/Radarr)' },
      { type: 'feature', text: 'File browser for library path selection' },
    ]
  },
  {
    version: '1.2.0', date: '2025-02-01', type: 'minor', title: 'Initial Public Release',
    highlights: ['Core media pipeline', 'TMDB integration', 'Built-in torrent client'],
    changes: [
      { type: 'feature', text: 'Media library management with automatic metadata fetching' },
      { type: 'feature', text: 'TMDB integration for movies and TV shows' },
      { type: 'feature', text: 'LTorrent - built-in pure Python torrent client' },
    ]
  }
];

export const AboutSettings = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemInfo, setSystemInfo] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState('2.5.7');

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
            <p className="text-sm text-gray-400">Version {systemInfo?.version || '2.5.7'}</p>
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
          <h3 className="text-2xl font-bold text-white mb-2">WatchNexus v{systemInfo?.version || '2.5.7'}</h3>
          <p className="text-gray-300">Unified Media Pipeline - Your Personal Netflix, Plex & Jellyfin in One</p>
          <p className="text-sm text-gray-400 mt-2">A self-hosted media server that replaces Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin.</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400" />
          <span className="text-sm text-gray-400">Made with love</span>
        </div>
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
          { label: 'Backend', value: 'FastAPI + Python' },
          { label: 'Frontend', value: 'React + Tailwind' },
          { label: 'Database', value: 'SQLite (WAL)' },
          { label: 'Torrent Engine', value: 'LTorrent' },
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
        <p><strong>Communities:</strong> Jellyfin community, r/selfhosted, r/homelab</p>
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
    <div className="px-6 py-4 border-b border-white/10">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Tag className="w-5 h-5 text-violet-400" />
        Release History
      </h3>
    </div>
    <div className="divide-y divide-white/10">
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
            This includes but is not limited to: TMDB, Jellyfin, Plex, Kodi, Sonarr, Radarr, Prowlarr, qBittorrent, 
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
