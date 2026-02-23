import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Info, Tag, Calendar, CheckCircle2, Bug, Sparkles,
  ChevronDown, ChevronUp, ExternalLink, Github, Heart,
  Zap, Shield, Wrench, Code
} from 'lucide-react';
import { Button } from '../ui/button';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Release history with all versions
const RELEASES = [
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
  const [expandedVersion, setExpandedVersion] = useState('2.0.1');
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
                WatchNexus v{systemInfo?.version || '2.0.1'}
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

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 py-4">
        <p>WatchNexus is open source and self-hosted.</p>
        <p className="mt-1">Your media, your server, your rules.</p>
      </div>
    </motion.div>
  );
};

export default AboutSettings;
