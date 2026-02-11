import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, CheckCircle, Terminal, RefreshCw, 
  Database, Wifi, Download, Film, Lock, Server,
  ChevronRight, ExternalLink, Copy, Check
} from 'lucide-react';

const troubleshootingGuides = [
  {
    id: 'startup',
    title: 'Application Won\'t Start',
    icon: Server,
    severity: 'high',
    symptoms: [
      'Application crashes on launch',
      'Blank white screen',
      'Process starts but UI never loads',
      'Error: "Port already in use"'
    ],
    solutions: [
      {
        title: 'Check if ports are in use',
        steps: [
          'Open terminal/command prompt',
          'Run: netstat -an | grep 3000 (or 8001)',
          'If in use, stop the conflicting process',
          'Or change WatchNexus ports in config'
        ],
        code: '# Linux/macOS\nlsof -i :3000\nkill -9 <PID>\n\n# Windows\nnetstat -ano | findstr :3000\ntaskkill /PID <PID> /F'
      },
      {
        title: 'Clear application cache',
        steps: [
          'Close WatchNexus completely',
          'Delete the cache folder',
          'Restart the application'
        ],
        code: '# Linux\nrm -rf ~/.config/watchnexus/cache\n\n# macOS\nrm -rf ~/Library/Application\\ Support/watchnexus/cache\n\n# Windows\nrd /s /q %APPDATA%\\watchnexus\\cache'
      },
      {
        title: 'Verify MongoDB connection',
        steps: [
          'Ensure MongoDB is running',
          'Check connection string in config',
          'Test connection with mongosh'
        ],
        code: '# Check MongoDB status\nsudo systemctl status mongod\n\n# Start MongoDB\nsudo systemctl start mongod\n\n# Test connection\nmongosh --eval "db.adminCommand(\'ping\')"'
      }
    ]
  },
  {
    id: 'downloads',
    title: 'Downloads Not Working',
    icon: Download,
    severity: 'medium',
    symptoms: [
      'Torrents stuck at 0%',
      'No peers connecting',
      'Download speed is 0',
      '"Failed to add torrent" error'
    ],
    solutions: [
      {
        title: 'Check firewall/port forwarding',
        steps: [
          'Ensure BitTorrent ports (6881-6889) are open',
          'Configure port forwarding on your router',
          'Temporarily disable firewall to test'
        ],
        code: '# Check if port is open\nnc -zv localhost 6881\n\n# Open port on Linux (ufw)\nsudo ufw allow 6881:6889/tcp\nsudo ufw allow 6881:6889/udp'
      },
      {
        title: 'Verify disk space',
        steps: [
          'Check available space on download drive',
          'Ensure at least 10GB free space',
          'Clear completed downloads if needed'
        ],
        code: '# Linux/macOS\ndf -h /path/to/downloads\n\n# Windows\nwmic logicaldisk get size,freespace,caption'
      },
      {
        title: 'Reset Fondue torrent engine',
        steps: [
          'Stop all active downloads',
          'Go to Settings > Advanced',
          'Click "Reset Torrent Engine"',
          'Restart WatchNexus'
        ]
      }
    ]
  },
  {
    id: 'playback',
    title: 'Media Playback Issues',
    icon: Film,
    severity: 'medium',
    symptoms: [
      'Video won\'t play',
      'Audio out of sync',
      'Buffering constantly',
      'Subtitles not showing'
    ],
    solutions: [
      {
        title: 'Check file format compatibility',
        steps: [
          'Verify the file format is supported',
          'Supported: MP4, MKV, AVI, MOV, WebM',
          'Unsupported codecs may need transcoding'
        ]
      },
      {
        title: 'Clear media cache',
        steps: [
          'Go to Settings > Library',
          'Click "Clear Media Cache"',
          'Rescan your library'
        ],
        code: '# Manual cache clear\nrm -rf ~/.config/watchnexus/media-cache/*'
      },
      {
        title: 'Fix subtitle sync',
        steps: [
          'Use keyboard shortcuts to adjust sync',
          'Press G to delay subtitles (-100ms)',
          'Press H to advance subtitles (+100ms)',
          'Or re-download subtitles from Garnish'
        ]
      }
    ]
  },
  {
    id: 'indexers',
    title: 'Indexers Not Returning Results',
    icon: Wifi,
    severity: 'medium',
    symptoms: [
      'Search returns 0 results',
      'Syrup scrapers failing',
      '"Connection timeout" errors',
      'Cloudflare challenge failed'
    ],
    solutions: [
      {
        title: 'Check network connectivity',
        steps: [
          'Verify internet connection',
          'Try accessing indexer sites in browser',
          'Check if VPN is blocking connections',
          'Some ISPs block torrent sites'
        ]
      },
      {
        title: 'Update Preserve bypass',
        steps: [
          'Go to Settings > Indexers',
          'Toggle "Enable Preserve" off and on',
          'Try different user agent strings',
          'Consider using a VPN'
        ]
      },
      {
        title: 'Add custom indexers',
        steps: [
          'If built-in scrapers fail, add Torznab indexers',
          'Go to Settings > Indexers',
          'Click "Add Indexer"',
          'Enter your Torznab API URL and key'
        ],
        code: '# Example Torznab URL format\nhttps://indexer.example.com/api?apikey=YOUR_API_KEY'
      }
    ]
  },
  {
    id: 'database',
    title: 'Database Errors',
    icon: Database,
    severity: 'high',
    symptoms: [
      '"Connection refused" errors',
      'Library not loading',
      'Progress not saving',
      'MongoDB crashes'
    ],
    solutions: [
      {
        title: 'Restart MongoDB',
        steps: [
          'Stop the MongoDB service',
          'Wait 10 seconds',
          'Start the MongoDB service',
          'Check logs for errors'
        ],
        code: '# Linux\nsudo systemctl restart mongod\nsudo journalctl -u mongod -f\n\n# macOS (Homebrew)\nbrew services restart mongodb-community\n\n# Docker\ndocker restart watchnexus-mongo'
      },
      {
        title: 'Repair database',
        steps: [
          'Stop WatchNexus',
          'Run MongoDB repair',
          'Restart both services'
        ],
        code: '# Backup first!\nmongodump --out=/backup/watchnexus\n\n# Repair\nmongod --repair --dbpath /var/lib/mongodb\n\n# Or compact\nmongo watchnexus --eval "db.runCommand({compact:\'library\'})"'
      },
      {
        title: 'Reset to clean database',
        steps: [
          'This will delete all data!',
          'Export any important data first',
          'Drop the database',
          'Restart WatchNexus to recreate'
        ],
        code: '# WARNING: Data loss!\nmongosh\nuse watchnexus\ndb.dropDatabase()'
      }
    ]
  },
  {
    id: 'remote',
    title: 'Remote Access Not Working',
    icon: Lock,
    severity: 'low',
    symptoms: [
      'Can\'t access from outside network',
      'Gelatin tunnels not connecting',
      'Share links not working',
      'Connection refused on external IP'
    ],
    solutions: [
      {
        title: 'Configure port forwarding',
        steps: [
          'Access your router admin panel',
          'Find Port Forwarding settings',
          'Forward ports 3000 and 8001 to your server IP',
          'Save and test with external device'
        ]
      },
      {
        title: 'Check Gelatin tunnel status',
        steps: [
          'Go to Settings > External Access',
          'Check if tunnel is active',
          'Click "Create New Tunnel" if needed',
          'Copy the provided external URL'
        ]
      },
      {
        title: 'Use reverse proxy',
        steps: [
          'Set up Nginx or Caddy as reverse proxy',
          'Configure SSL certificates (Let\'s Encrypt)',
          'Point your domain to the proxy'
        ],
        code: '# Nginx example config\nserver {\n    listen 443 ssl;\n    server_name watchnexus.yourdomain.com;\n    \n    ssl_certificate /path/to/cert.pem;\n    ssl_certificate_key /path/to/key.pem;\n    \n    location / {\n        proxy_pass http://localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n    }\n    \n    location /api {\n        proxy_pass http://localhost:8001;\n    }\n}'
      }
    ]
  }
];

const quickFixes = [
  { label: 'Restart WatchNexus', command: 'sudo systemctl restart watchnexus' },
  { label: 'Check logs', command: 'tail -f ~/.config/watchnexus/logs/app.log' },
  { label: 'Verify services', command: 'systemctl status watchnexus mongod' },
  { label: 'Test API', command: 'curl http://localhost:8001/api/health' },
];

export const TroubleshootingPage = () => {
  const [selectedGuide, setSelectedGuide] = useState('startup');
  const [copied, setCopied] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const guide = troubleshootingGuides.find(g => g.id === selectedGuide);

  return (
    <div className="pt-24 pb-16" data-testid="troubleshooting-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-600/20 to-red-600/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Troubleshooting</span> Guide
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Having issues? Find solutions to common problems below.
          </p>
        </motion.div>

        {/* Quick Fixes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12 p-6 rounded-2xl glass"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-violet-400" />
            Quick Fixes (Try These First)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickFixes.map((fix, index) => (
              <button
                key={index}
                onClick={() => copyToClipboard(fix.command, `quick-${index}`)}
                className="flex items-center justify-between p-3 rounded-lg bg-black/30 hover:bg-black/50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-violet-400" />
                  <span className="text-sm">{fix.label}</span>
                </div>
                {copied === `quick-${index}` ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500 group-hover:text-white" />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-24 space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">
                Problem Categories
              </h3>
              {troubleshootingGuides.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGuide(g.id)}
                  data-testid={`guide-${g.id}`}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    selectedGuide === g.id
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                      : 'glass text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <g.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{g.title}</span>
                  {g.severity === 'high' && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            key={selectedGuide}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3"
          >
            <div className="p-8 rounded-2xl glass">
              {/* Header */}
              <div className="flex items-start gap-4 mb-8">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  guide.severity === 'high' 
                    ? 'bg-red-500/20' 
                    : guide.severity === 'medium'
                    ? 'bg-orange-500/20'
                    : 'bg-blue-500/20'
                }`}>
                  <guide.icon className={`w-7 h-7 ${
                    guide.severity === 'high' 
                      ? 'text-red-400' 
                      : guide.severity === 'medium'
                      ? 'text-orange-400'
                      : 'text-blue-400'
                  }`} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">{guide.title}</h2>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    guide.severity === 'high' 
                      ? 'bg-red-500/20 text-red-400' 
                      : guide.severity === 'medium'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {guide.severity.toUpperCase()} PRIORITY
                  </span>
                </div>
              </div>

              {/* Symptoms */}
              <div className="mb-8">
                <h3 className="font-semibold mb-3 text-gray-400">Common Symptoms:</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {guide.symptoms.map((symptom, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-violet-400" />
                      {symptom}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Solutions */}
              <div className="space-y-6">
                <h3 className="font-semibold text-lg">Solutions:</h3>
                {guide.solutions.map((solution, sIndex) => (
                  <div key={sIndex} className="p-6 rounded-xl bg-surface/50 border border-white/5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold">
                        {sIndex + 1}
                      </div>
                      <h4 className="font-semibold">{solution.title}</h4>
                    </div>
                    
                    <ol className="space-y-2 mb-4">
                      {solution.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-start gap-3 text-gray-300 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ol>

                    {solution.code && (
                      <div className="relative">
                        <button
                          onClick={() => copyToClipboard(solution.code, `${guide.id}-${sIndex}`)}
                          className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          {copied === `${guide.id}-${sIndex}` ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <pre className="bg-black/50 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
                          <code>{solution.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Still Need Help */}
            <div className="mt-8 p-6 rounded-xl glass text-center">
              <h3 className="font-semibold mb-2">Still need help?</h3>
              <p className="text-gray-400 text-sm mb-4">
                If these solutions don't work, reach out to the community.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://github.com/watchnexus/watchnexus/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open GitHub Issue
                </a>
                <a
                  href="https://discord.gg/watchnexus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Join Discord
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
