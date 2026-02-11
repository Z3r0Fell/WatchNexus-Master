import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, Apple, Monitor, Terminal, Check, Copy, ExternalLink,
  Cpu, HardDrive, MemoryStick, Globe
} from 'lucide-react';

const platforms = [
  {
    id: 'windows',
    name: 'Windows',
    icon: Monitor,
    versions: ['Windows 11', 'Windows 10'],
    downloadUrl: '#',
    fileName: 'WatchNexus-Setup-1.0.0.exe',
    size: '~180 MB',
    instructions: [
      'Download the installer (.exe)',
      'Run the installer as Administrator',
      'Follow the installation wizard',
      'Launch WatchNexus from Start Menu'
    ]
  },
  {
    id: 'macos',
    name: 'macOS',
    icon: Apple,
    versions: ['macOS 14 Sonoma', 'macOS 13 Ventura', 'macOS 12 Monterey'],
    downloadUrl: '#',
    fileName: 'WatchNexus-1.0.0.dmg',
    size: '~200 MB',
    instructions: [
      'Download the DMG file',
      'Open the DMG and drag WatchNexus to Applications',
      'Right-click and select "Open" for first launch',
      'Grant necessary permissions when prompted'
    ]
  },
  {
    id: 'linux',
    name: 'Linux',
    icon: Terminal,
    versions: ['Ubuntu 22.04+', 'Fedora 38+', 'Arch Linux', 'Debian 12+'],
    downloadUrl: '#',
    fileName: 'watchnexus-1.0.0.AppImage',
    size: '~190 MB',
    instructions: [
      'Download the AppImage',
      'Make it executable: chmod +x watchnexus-*.AppImage',
      'Run: ./watchnexus-1.0.0.AppImage',
      'Or use your distro package manager (see below)'
    ]
  }
];

const archInstructions = `# Arch Linux (AUR)
yay -S watchnexus-bin

# Or build from source
git clone https://github.com/watchnexus/watchnexus.git
cd watchnexus
./scripts/build-arch.sh`;

const debianInstructions = `# Debian/Ubuntu
wget https://github.com/watchnexus/releases/latest/watchnexus.deb
sudo dpkg -i watchnexus.deb
sudo apt-get install -f  # Fix dependencies

# Or via APT repository
curl -fsSL https://watchnexus.ca/gpg | sudo gpg --dearmor -o /usr/share/keyrings/watchnexus.gpg
echo "deb [signed-by=/usr/share/keyrings/watchnexus.gpg] https://watchnexus.ca/apt stable main" | sudo tee /etc/apt/sources.list.d/watchnexus.list
sudo apt update && sudo apt install watchnexus`;

const fedoraInstructions = `# Fedora/RHEL
sudo dnf install https://github.com/watchnexus/releases/latest/watchnexus.rpm

# Or via COPR
sudo dnf copr enable watchnexus/watchnexus
sudo dnf install watchnexus`;

const dockerInstructions = `# Docker (All Platforms)
docker pull watchnexus/watchnexus:latest

docker run -d \\
  --name watchnexus \\
  -p 3000:3000 \\
  -p 8001:8001 \\
  -v ~/watchnexus/config:/config \\
  -v ~/watchnexus/media:/media \\
  -v ~/watchnexus/downloads:/downloads \\
  watchnexus/watchnexus:latest`;

const requirements = [
  { icon: Cpu, label: 'CPU', value: '2+ cores recommended' },
  { icon: MemoryStick, label: 'RAM', value: '4GB minimum, 8GB recommended' },
  { icon: HardDrive, label: 'Storage', value: '500MB for app + media storage' },
  { icon: Globe, label: 'Network', value: 'Internet for metadata & downloads' },
];

export const DownloadPage = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('windows');
  const [copied, setCopied] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const platform = platforms.find(p => p.id === selectedPlatform);

  return (
    <div className="pt-24 pb-16" data-testid="download-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Download <span className="gradient-text">WatchNexus</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Get WatchNexus for your platform. Free, open-source, and self-hosted.
          </p>
        </motion.div>

        {/* Platform Selector */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center gap-4 mb-12"
        >
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              data-testid={`platform-${p.id}`}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all ${
                selectedPlatform === p.id
                  ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white'
                  : 'glass text-gray-300 hover:text-white hover:border-violet-500/50'
              }`}
            >
              <p.icon className="w-6 h-6" />
              <span className="font-medium">{p.name}</span>
            </button>
          ))}
        </motion.div>

        {/* Download Card */}
        <motion.div
          key={selectedPlatform}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <div className="p-8 rounded-2xl glass gradient-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">{platform.name}</h2>
                <p className="text-gray-400 text-sm">
                  Supported: {platform.versions.join(', ')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">{platform.fileName}</p>
                <p className="text-sm text-gray-500">{platform.size}</p>
              </div>
            </div>

            <a
              href={platform.downloadUrl}
              data-testid="download-button"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity mb-6"
            >
              <Download className="w-5 h-5" />
              Download for {platform.name}
            </a>

            <div>
              <h3 className="font-semibold mb-3">Installation Steps:</h3>
              <ol className="space-y-2">
                {platform.instructions.map((step, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </motion.div>

        {/* Linux Package Managers */}
        {selectedPlatform === 'linux' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto mb-16 space-y-6"
          >
            <h2 className="text-2xl font-bold text-center mb-8">
              Linux Package Managers
            </h2>

            {/* Arch Linux */}
            <div className="p-6 rounded-xl glass">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Arch Linux (AUR)</h3>
                <button
                  onClick={() => copyToClipboard(archInstructions, 'arch')}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  {copied === 'arch' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied === 'arch' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-black/50 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
                <code>{archInstructions}</code>
              </pre>
            </div>

            {/* Debian/Ubuntu */}
            <div className="p-6 rounded-xl glass">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Debian / Ubuntu</h3>
                <button
                  onClick={() => copyToClipboard(debianInstructions, 'debian')}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  {copied === 'debian' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied === 'debian' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-black/50 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
                <code>{debianInstructions}</code>
              </pre>
            </div>

            {/* Fedora */}
            <div className="p-6 rounded-xl glass">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Fedora / RHEL</h3>
                <button
                  onClick={() => copyToClipboard(fedoraInstructions, 'fedora')}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                >
                  {copied === 'fedora' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied === 'fedora' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-black/50 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
                <code>{fedoraInstructions}</code>
              </pre>
            </div>
          </motion.div>
        )}

        {/* Docker Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto mb-16"
        >
          <div className="p-6 rounded-xl glass">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.186v1.887c0 .102.083.185.185.185zm-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.186zm0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186zm-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186zm-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186zm5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.186v1.887c0 .102.082.185.185.185zm-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.083.185.185.185zm-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.119a.185.185 0 00-.185.186v1.887c0 .102.083.185.185.185zm-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185zm-2.95 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H.136a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185zM24 11.508a4.48 4.48 0 01-.453 1.962 4.47 4.47 0 01-1.253 1.585 4.49 4.49 0 01-1.811.88 4.584 4.584 0 01-2.088.027l-4.412-.987a.185.185 0 00-.218.144l-.277 1.234a.186.186 0 00.144.22l1.054.235c.05.011.1.02.15.027.05.007.1.012.151.015l.076.004h.076a1.854 1.854 0 001.304-.457l.018-.016.018-.018a1.86 1.86 0 00.541-1.15c.01-.068.016-.137.017-.206l-.001-.034.001-.017v-.017a.185.185 0 00-.119-.175.188.188 0 00-.066-.012h-3.07a.185.185 0 00-.185.185v2.26a.185.185 0 00.185.186h1.033c.05 0 .098-.02.133-.055l.005-.006a.185.185 0 00.047-.126v-.83a.093.093 0 01.093-.092h.556a.093.093 0 01.093.092v.83a.185.185 0 00.185.187h1.033a.186.186 0 00.186-.187v-.83a.093.093 0 01.093-.092h.556a.093.093 0 01.093.092v.83a.185.185 0 00.186.187h1.033a.186.186 0 00.186-.187v-2.26a.186.186 0 00-.186-.185h-5.574a1.86 1.86 0 00-1.303.457l-.02.016a1.86 1.86 0 00-.558 1.168c-.01.068-.015.137-.016.206v.034-.017l.001.017a.185.185 0 00.185.187h.556a.185.185 0 00.186-.187v-.017l.001.017-.001-.034c.001-.069.007-.138.016-.206a1.86 1.86 0 01.558-1.168l.02-.016a1.86 1.86 0 011.303-.457h.74v-2.26a.185.185 0 00-.186-.185h-3.07a.185.185 0 00-.185.185v.83a.093.093 0 01-.093.092h-.556a.093.093 0 01-.093-.092v-.83a.185.185 0 00-.185-.185h-1.033a.185.185 0 00-.186.185v.83a.093.093 0 01-.093.092h-.556a.093.093 0 01-.093-.092v-.83a.185.185 0 00-.185-.185h-1.034a.185.185 0 00-.185.185v2.26c0 .102.083.185.185.185h5.574z"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-lg">Docker (All Platforms)</h3>
              </div>
              <button
                onClick={() => copyToClipboard(dockerInstructions, 'docker')}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
              >
                {copied === 'docker' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied === 'docker' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-black/50 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
              <code>{dockerInstructions}</code>
            </pre>
          </div>
        </motion.div>

        {/* System Requirements */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-2xl font-bold text-center mb-8">System Requirements</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {requirements.map((req) => (
              <div key={req.label} className="p-6 rounded-xl glass text-center">
                <req.icon className="w-8 h-8 text-violet-400 mx-auto mb-3" />
                <p className="font-semibold mb-1">{req.label}</p>
                <p className="text-gray-400 text-sm">{req.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Build from Source */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto mt-16 text-center"
        >
          <h2 className="text-2xl font-bold mb-4">Build from Source</h2>
          <p className="text-gray-400 mb-6">
            WatchNexus is open source. Clone the repository and build it yourself.
          </p>
          <a
            href="https://github.com/watchnexus/watchnexus"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            View on GitHub
          </a>
        </motion.div>
      </div>
    </div>
  );
};
