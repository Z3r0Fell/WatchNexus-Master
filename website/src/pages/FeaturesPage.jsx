import { motion } from 'framer-motion';
import { 
  Film, Tv, Music, BookOpen, Download, Globe, Users, 
  Palette, Plug, Shield, Zap, Search, Subtitles, Radio,
  HardDrive, CheckCircle, Wifi
} from 'lucide-react';

const featureCategories = [
  {
    title: 'Media Management',
    icon: Film,
    features: [
      { name: 'Marmalade Media Server', desc: 'Stream movies, TV, music, and audiobooks', icon: Film },
      { name: 'Library Scanning', desc: 'Automatic organization and metadata', icon: Search },
      { name: 'Watch Progress', desc: 'Resume where you left off', icon: CheckCircle },
      { name: 'Thumbnails & Artwork', desc: 'Beautiful poster art from TMDB', icon: Tv },
    ]
  },
  {
    title: 'Downloads & Indexers',
    icon: Download,
    features: [
      { name: 'Fondue Torrent Engine', desc: 'Built-in libtorrent client', icon: Download },
      { name: 'Syrup Indexer Aggregator', desc: 'Search 1337x, YTS, EZTV', icon: Search },
      { name: 'Compote Index Manager', desc: 'Torznab, RSS feed support', icon: HardDrive },
      { name: 'Preserve Cloudflare Bypass', desc: 'Access protected sites', icon: Shield },
    ]
  },
  {
    title: 'Social & Sharing',
    icon: Users,
    features: [
      { name: 'Potluck Watch Parties', desc: 'Synchronized viewing with chat', icon: Users },
      { name: 'Gelatin Remote Access', desc: 'Stream from anywhere', icon: Globe },
      { name: 'Share Links', desc: 'Invite friends with a link', icon: Wifi },
      { name: 'Live Reactions', desc: 'Emoji reactions during playback', icon: Zap },
    ]
  },
  {
    title: 'Customization',
    icon: Palette,
    features: [
      { name: 'Milk Theme Engine', desc: '6 built-in themes', icon: Palette },
      { name: 'Theme Forge', desc: 'Create custom themes', icon: Palette },
      { name: 'Gadgets Plugin System', desc: 'Extend with plugins', icon: Plug },
      { name: 'Streaming Service Logins', desc: '11 services supported', icon: Tv },
    ]
  },
  {
    title: 'Subtitles & Audio',
    icon: Subtitles,
    features: [
      { name: 'Garnish Subtitle Service', desc: 'Addic7ed & OpenSubtitles', icon: Subtitles },
      { name: 'Multi-language Support', desc: 'Search in any language', icon: Globe },
      { name: 'Auto-download', desc: 'Fetch subtitles automatically', icon: Download },
      { name: 'Hearing Impaired', desc: 'SDH subtitle support', icon: CheckCircle },
    ]
  },
  {
    title: 'Live & Radio',
    icon: Radio,
    features: [
      { name: 'IPTV Support', desc: 'M3U playlist import', icon: Radio },
      { name: 'EPG Data', desc: 'TV guide integration', icon: Tv },
      { name: 'Live Streaming', desc: 'Watch live channels', icon: Zap },
      { name: 'Recording', desc: 'DVR functionality (coming soon)', icon: HardDrive },
    ]
  },
];

export const FeaturesPage = () => {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Feature <span className="gradient-text">Overview</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Discover everything WatchNexus can do for your media management needs.
          </p>
        </motion.div>

        {/* Feature Categories */}
        <div className="space-y-16">
          {featureCategories.map((category, catIndex) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: catIndex * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 flex items-center justify-center">
                  <category.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold">{category.title}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {category.features.map((feature, index) => (
                  <motion.div
                    key={feature.name}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="p-5 rounded-xl glass hover:border-violet-500/30 transition-colors"
                  >
                    <feature.icon className="w-8 h-8 text-violet-400 mb-3" />
                    <h3 className="font-semibold mb-1">{feature.name}</h3>
                    <p className="text-gray-400 text-sm">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Module List */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 p-8 rounded-2xl glass"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">All Modules 🍯</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
            {[
              { name: 'Syrup', emoji: '🍯' },
              { name: 'Preserve', emoji: '🫙' },
              { name: 'Pulp', emoji: '🍊' },
              { name: 'Compote', emoji: '🍇' },
              { name: 'Marmalade', emoji: '🍊' },
              { name: 'Gelatin', emoji: '🍮' },
              { name: 'Potluck', emoji: '🍲' },
              { name: 'Garnish', emoji: '🌿' },
              { name: 'Fondue', emoji: '🫕' },
              { name: 'Sieve', emoji: '🫗' },
              { name: 'Gadgets', emoji: '🔧' },
              { name: 'Milk', emoji: '🥛' },
              { name: 'Juice', emoji: '🧃' },
            ].map((module) => (
              <div key={module.name} className="p-3">
                <span className="text-2xl">{module.emoji}</span>
                <p className="text-sm font-medium mt-1">{module.name}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
