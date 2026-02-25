import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Info, Tag, Calendar, CheckCircle2, Bug, Sparkles,
  ChevronDown, ChevronUp, ExternalLink, Github, Heart,
  Zap, Shield, Wrench, Code, Users, Crown, Star, 
  Gem, Award, Trophy, Coffee, Rocket
} from 'lucide-react';
import { Button } from '../ui/button';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Credits data - Contributors and supporters
const CREDITS = {
  foundingMembers: {
    title: "Founding Members",
    icon: Crown,
    color: "from-yellow-500 to-amber-600",
    description: "The visionaries who believed from day one",
    members: [
      // Add founding members here
      // { name: "Name", avatar: "URL", title: "Title" }
    ]
  },
  superSponsors: {
    title: "Super Sponsors",
    icon: Gem,
    color: "from-violet-500 to-purple-600",
    description: "Extraordinary supporters who made this possible",
    members: [
      // Add super sponsors here
    ]
  },
  codeContributors: {
    title: "Code Contributors",
    icon: Code,
    color: "from-blue-500 to-cyan-600",
    description: "The developers who shaped WatchNexus",
    members: [
      // Add code contributors here
    ]
  },
  backers: {
    title: "Backers",
    icon: Heart,
    color: "from-pink-500 to-rose-600",
    description: "Our amazing crowdfunding supporters",
    members: [
      // Add backers here
    ]
  },
  superFans: {
    title: "Super Fans",
    icon: Star,
    color: "from-orange-500 to-red-600",
    description: "Community champions and early adopters",
    members: [
      // Add super fans here
    ]
  }
};

// Tier badge colors
const TIER_BADGES = {
  founding: { bg: 'bg-gradient-to-r from-yellow-500 to-amber-600', text: 'text-yellow-100' },
  superSponsor: { bg: 'bg-gradient-to-r from-violet-500 to-purple-600', text: 'text-violet-100' },
  contributor: { bg: 'bg-gradient-to-r from-blue-500 to-cyan-600', text: 'text-blue-100' },
  backer: { bg: 'bg-gradient-to-r from-pink-500 to-rose-600', text: 'text-pink-100' },
  superFan: { bg: 'bg-gradient-to-r from-orange-500 to-red-600', text: 'text-orange-100' },
};

// Release history with all versions
const RELEASES = [
  {
    version: '2.5.6',
    date: '2025-02-25',
    type: 'minor',
    title: 'Gadgets Catalogue & Library Overhaul',
    highlights: [
      'Gadgets Catalogue with 45 extensions',
      'Movies & TV Shows now show local library',
      'Anime as distinct media category',
      'Container banner assets for Docker/Unraid',
      '12 release packages'
    ],
    changes: [
      { type: 'feature', text: 'Gadgets Catalogue: 45 built-in extensions across 16 categories (Metadata, Subtitles, Notifications, Themes, Video, Audio, Indexers, System, etc.)' },
      { type: 'feature', text: 'Movies page: Dual Library/Discover view showing local media + TMDB discovery' },
      { type: 'feature', text: 'TV Shows page: Dual Library/Discover view with automatic series grouping' },
      { type: 'feature', text: 'Anime page: Fully distinct category with dedicated library support and anime-specific discovery filters' },
      { type: 'feature', text: 'Container banner pack integrated for Docker Hub, Unraid, and dashboard previews' },
      { type: 'improvement', text: 'Renamed "Plugins" to "Gadgets" throughout the application' },
      { type: 'improvement', text: 'Gadgets settings page redesigned with Browse Catalogue and Installed views' },
      { type: 'improvement', text: 'All 12 application components packaged as distributable zip archives' },
    ]
  },
  {
    version: '2.5.5',
    date: '2025-02-24',
    type: 'minor',
    title: 'Theming, Security & Code Audit',
    highlights: [
      'Complete theming system overhaul',
      'Critical security patch',
      'Credits section added',
      'Comprehensive code audit'
    ],
    changes: [
      { type: 'feature', text: 'Full light/dark mode system with user-selectable color themes via Theme Forge' },
      { type: 'feature', text: 'Credits & Acknowledgements section for contributors, backers, and sponsors' },
      { type: 'feature', text: 'Music library page: Browse and stream local music collections' },
      { type: 'feature', text: 'Audiobooks library page: Browse and listen to local audiobook files' },
      { type: 'feature', text: 'Database reset with schema version tracking' },
      { type: 'feature', text: 'Customizable sidebar with show/hide tab settings' },
      { type: 'security', text: 'Patched unauthenticated media streaming endpoint (critical vulnerability)' },
      { type: 'fix', text: 'Fixed CSS variable mismatches causing invisible UI elements in dark mode' },
      { type: 'fix', text: 'Fixed file browser to correctly show user home directories' },
      { type: 'improvement', text: 'All UI components refactored to respect selected theme colors' },
      { type: 'docs', text: 'Created Fortress Code Protection Plan, Harbor Docker/RPi Plan, Project Echo FFmpeg Investigation' },
    ]
  },
  {
    version: '2.5.0',
    date: '2025-02-22',
    type: 'major',
    title: 'Multi-Platform Client Release',
    highlights: [
      'Client apps for 5 platforms',
      'System tray application',
      'Auto-updater system',
      'Who\'s Watching profiles'
    ],
    changes: [
      { type: 'feature', text: 'Android client (Sapphire): Native mobile media browser and player' },
      { type: 'feature', text: 'Android TV client (Emerald): 10-foot UI optimized for remote control' },
      { type: 'feature', text: 'Fire TV client (Ruby): Amazon Firestick optimized interface' },
      { type: 'feature', text: 'Roku client (Topaz): BrightScript channel for Roku devices' },
      { type: 'feature', text: 'Kodi addon (Diamond): Full WatchNexus integration for Kodi' },
      { type: 'feature', text: 'Beacon system tray app for server management (start/stop/config)' },
      { type: 'feature', text: 'Tiramisu auto-updater for seamless version updates' },
      { type: 'feature', text: 'Who\'s Watching profile selector for password-less home network login' },
      { type: 'feature', text: 'Cloud sync planning (Marshmallow) completed' },
    ]
  },
  {
    version: '2.1.0',
    date: '2025-02-23',
    type: 'minor',
    title: 'Critical Fixes Release',
    highlights: [
      'Folder browser now working',
      'User management UX improved',
      'Authentication loop fixed',
      'Release packaging improved'
    ],
    changes: [
      { type: 'fix', text: 'Fixed folder browser modal not appearing when clicking browse button' },
      { type: 'fix', text: 'Fixed user edit panel closing after every permission toggle' },
      { type: 'fix', text: 'Fixed authentication loop caused by aggressive logout on transient errors' },
      { type: 'fix', text: 'Removed withCredentials causing cookie issues on same-origin requests' },
      { type: 'improvement', text: 'Edit panel now stays open when toggling user permissions' },
      { type: 'improvement', text: 'Added data-testid attributes for better testing' },
    ]
  },
  {
    version: '2.0.1',
    date: '2025-02-15',
    type: 'major',
    title: 'Code Audit & Feature Release',
    highlights: [
      'Comprehensive code audit completed',
      'Skip Intro/Credits feature with Chromaprint',
      'Plugin system overhaul with import support',
      'Competitive analysis documentation'
    ],
    changes: [
      { type: 'feature', text: 'Added Skip Intro/Credits functionality with auto-detection using Chromaprint audio fingerprinting' },
      { type: 'feature', text: 'New Playback Settings section for configuring auto-play and skip behaviors' },
      { type: 'feature', text: 'Plugin marketplace UI overhaul with enable/disable controls' },
      { type: 'feature', text: 'Plugin import functionality - add custom plugins from filesystem' },
      { type: 'fix', text: 'Fixed plugin auto-discovery on backend startup' },
      { type: 'fix', text: 'Fixed playback settings database table creation' },
      { type: 'improvement', text: 'Comprehensive code audit fixing broken routes and error handling' },
      { type: 'docs', text: 'Added competitive analysis document comparing Jellyfin, Plex, and *arr suite' },
    ]
  },
  {
    version: '2.0.0',
    date: '2025-02-14',
    type: 'major',
    title: 'Major Architecture Update',
    highlights: [
      'Complete UI/UX redesign',
      'New plugin architecture',
      'Enhanced media management',
      'Quality profiles system'
    ],
    changes: [
      { type: 'feature', text: 'New dark theme with glass-morphism design' },
      { type: 'feature', text: 'Anime as distinct media category' },
      { type: 'feature', text: 'Quality profiles for downloads (like Sonarr/Radarr)' },
      { type: 'feature', text: 'File browser for library path selection' },
      { type: 'feature', text: 'Playlist support for back-to-back playback' },
      { type: 'improvement', text: 'Restructured settings into organized sections' },
      { type: 'improvement', text: 'Enhanced library scanning with progress indicators' },
    ]
  },
  {
    version: '1.5.0',
    date: '2025-02-10',
    type: 'minor',
    title: 'Download & Indexer Improvements',
    highlights: [
      'Download queue management',
      'Indexer health monitoring',
      'Maintenance dashboard'
    ],
    changes: [
      { type: 'feature', text: 'Download queue with pause/resume/cancel controls' },
      { type: 'feature', text: 'Indexer health check with connectivity status' },
      { type: 'feature', text: 'Maintenance tab with system stats and log viewer' },
      { type: 'feature', text: 'Database backup and optimization tools' },
      { type: 'fix', text: 'Fixed media poster fetching from TMDB' },
    ]
  },
  {
    version: '1.2.5',
    date: '2025-02-05',
    type: 'patch',
    title: 'Bug Fixes & Stability',
    highlights: [
      'Media scanning improvements',
      'Authentication fixes',
      'UI polish'
    ],
    changes: [
      { type: 'fix', text: 'Fixed library scanning for nested directories' },
      { type: 'fix', text: 'Fixed Google OAuth callback handling' },
      { type: 'fix', text: 'Fixed port conflict detection on startup' },
      { type: 'improvement', text: 'Improved error messages and logging' },
    ]
  },
  {
    version: '1.2.0',
    date: '2025-02-01',
    type: 'minor',
    title: 'Initial Public Release',
    highlights: [
      'Core media pipeline',
      'TMDB integration',
      'Built-in torrent client'
    ],
    changes: [
      { type: 'feature', text: 'Media library management with automatic metadata fetching' },
      { type: 'feature', text: 'TMDB integration for movies and TV shows' },
      { type: 'feature', text: 'LTorrent - built-in pure Python torrent client' },
      { type: 'feature', text: 'User authentication with JWT tokens' },
      { type: 'feature', text: 'Cross-platform support (Linux, Windows, macOS)' },
    ]
  }
];

export const AboutSettings = () => {
  const [systemInfo, setSystemInfo] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState('2.5.6');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/system/info`);
        setSystemInfo(res.data);
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      } finally {
        setLoading(false);
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
    const colors = {
      major: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
      minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      patch: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    return colors[type] || colors.patch;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="about-settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Info className="w-5 h-5 text-violet-400" />
            About WatchNexus
          </h2>
          <p className="text-gray-400 text-sm">Version history and release notes</p>
        </div>
      </div>

      {/* Current Version Banner */}
      <div className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold text-white">
                WatchNexus v{systemInfo?.version || '2.5.6'}
              </h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getTypeBadge('major')}`}>
                Latest
              </span>
            </div>
            <p className="text-gray-300">
              Unified Media Pipeline - Your Personal Netflix, Plex & Jellyfin in One
            </p>
            <p className="text-sm text-gray-400 mt-2">
              A self-hosted media server that replaces Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-400">Made with love</span>
          </div>
        </div>
      </div>

      {/* Release History */}
      <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-violet-400" />
            Release History
          </h3>
        </div>

        <div className="divide-y divide-white/10">
          {RELEASES.map((release) => (
            <div key={release.version} className="group">
              {/* Release Header */}
              <div
                className="px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
                onClick={() => setExpandedVersion(expandedVersion === release.version ? null : release.version)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">v{release.version}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getTypeBadge(release.type)}`}>
                      {release.type}
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm text-gray-300">{release.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {release.date}
                  </div>
                  {expandedVersion === release.version ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Release Details */}
              {expandedVersion === release.version && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-6"
                >
                  {/* Highlights */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Highlights</p>
                    <div className="flex flex-wrap gap-2">
                      {release.highlights.map((highlight, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 text-xs bg-black/30 border border-white/10 rounded-full text-gray-300"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Changes */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Changes</p>
                    <div className="space-y-2">
                      {release.changes.map((change, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-sm"
                        >
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

      {/* Tech Stack */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-violet-400" />
          Technology Stack
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-400">Backend</p>
            <p className="text-white font-medium">FastAPI + Python</p>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-400">Frontend</p>
            <p className="text-white font-medium">React + Tailwind</p>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-400">Database</p>
            <p className="text-white font-medium">SQLite (WAL)</p>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-400">Torrent Engine</p>
            <p className="text-white font-medium">LTorrent (Pure Python)</p>
          </div>
        </div>
      </div>

      {/* Credits Section */}
      <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden" data-testid="credits-section">
        <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Credits & Acknowledgements
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            WatchNexus exists thanks to these amazing people
          </p>
        </div>

        <div className="p-6 space-y-8">
          {/* Founding Members */}
          <CreditTier 
            tier={CREDITS.foundingMembers}
            badge={TIER_BADGES.founding}
          />

          {/* Super Sponsors */}
          <CreditTier 
            tier={CREDITS.superSponsors}
            badge={TIER_BADGES.superSponsor}
          />

          {/* Code Contributors */}
          <CreditTier 
            tier={CREDITS.codeContributors}
            badge={TIER_BADGES.contributor}
          />

          {/* Backers */}
          <CreditTier 
            tier={CREDITS.backers}
            badge={TIER_BADGES.backer}
          />

          {/* Super Fans */}
          <CreditTier 
            tier={CREDITS.superFans}
            badge={TIER_BADGES.superFan}
          />

          {/* Become a Supporter CTA */}
          <div className="mt-8 p-6 bg-gradient-to-r from-violet-500/20 to-pink-500/20 border border-violet-500/30 rounded-xl text-center">
            <Rocket className="w-8 h-8 text-violet-400 mx-auto mb-3" />
            <h4 className="text-lg font-bold text-white mb-2">Want to see your name here?</h4>
            <p className="text-gray-300 text-sm mb-4">
              Support WatchNexus development and join our community of contributors
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button 
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => window.open('https://github.com/sponsors/watchnexus', '_blank')}
              >
                <Heart className="w-4 h-4 mr-2" /> Become a Sponsor
              </Button>
              <Button 
                variant="outline"
                className="border-white/20 hover:bg-white/10"
                onClick={() => window.open('https://github.com/watchnexus/watchnexus', '_blank')}
              >
                <Github className="w-4 h-4 mr-2" /> Contribute Code
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Special Thanks */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Coffee className="w-5 h-5 text-amber-400" />
          Special Thanks
        </h3>
        <div className="text-gray-300 text-sm space-y-2">
          <p>
            <strong>Open Source Projects:</strong> FFmpeg, LTorrent, FastAPI, React, Tailwind CSS, 
            and all the amazing open source tools that make WatchNexus possible.
          </p>
          <p>
            <strong>Communities:</strong> The Jellyfin community, r/selfhosted, r/homelab, 
            and all the passionate self-hosters who inspired this project.
          </p>
          <p>
            <strong>APIs:</strong> The Movie Database (TMDB), Addic7ed, OpenSubtitles, 
            and all the indexer providers.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 py-4">
        <p>WatchNexus is open source and self-hosted.</p>
        <p className="mt-1">Your media, your server, your rules.</p>
      </div>
    </motion.div>
  );
};

// Credit Tier Component
const CreditTier = ({ tier, badge }) => {
  const Icon = tier.icon;
  const hasMembers = tier.members && tier.members.length > 0;

  return (
    <div className="space-y-3">
      {/* Tier Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h4 className="font-bold text-white flex items-center gap-2">
            {tier.title}
            {hasMembers && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                {tier.members.length}
              </span>
            )}
          </h4>
          <p className="text-xs text-gray-400">{tier.description}</p>
        </div>
      </div>

      {/* Members Grid */}
      {hasMembers ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pl-13">
          {tier.members.map((member, idx) => (
            <div 
              key={idx}
              className="group relative bg-black/30 border border-white/10 rounded-xl p-3 hover:bg-white/5 hover:border-white/20 transition-all"
            >
              {/* Avatar */}
              <div className="w-12 h-12 mx-auto mb-2 rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800">
                {member.avatar ? (
                  <img 
                    src={member.avatar} 
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-500">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              {/* Name */}
              <p className="text-sm font-medium text-white text-center truncate">
                {member.name}
              </p>
              
              {/* Title/Role */}
              {member.title && (
                <p className="text-xs text-gray-500 text-center truncate">
                  {member.title}
                </p>
              )}
              
              {/* Tier Badge */}
              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${badge.bg} flex items-center justify-center shadow-lg`}>
                <Icon className="w-3 h-3 text-white" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pl-13">
          <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-6 text-center">
            <Icon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Be the first {tier.title.toLowerCase().slice(0, -1)}!
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Support WatchNexus to appear here
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutSettings;
