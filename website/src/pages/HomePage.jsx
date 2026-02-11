import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Play, Download, Zap, Shield, Globe, Users, Palette, Plug,
  Film, Tv, Music, BookOpen, Radio, ChevronRight, Star
} from 'lucide-react';

const features = [
  { icon: Film, title: 'Unified Library', desc: 'Movies, TV, music, audiobooks in one place' },
  { icon: Zap, title: 'Built-in Downloads', desc: 'No need for external torrent clients' },
  { icon: Globe, title: 'Remote Access', desc: 'Stream from anywhere with Gelatin' },
  { icon: Users, title: 'Watch Parties', desc: 'Synchronized viewing with friends' },
  { icon: Palette, title: 'Custom Themes', desc: '6 themes + create your own' },
  { icon: Plug, title: 'Plugin System', desc: 'Extend with custom plugins' },
];

const modules = [
  { name: 'Marmalade', emoji: '🍊', desc: 'Media Server' },
  { name: 'Fondue', emoji: '🫕', desc: 'Torrent Engine' },
  { name: 'Garnish', emoji: '🌿', desc: 'Subtitles' },
  { name: 'Potluck', emoji: '🍲', desc: 'Watch Party' },
  { name: 'Gelatin', emoji: '🍮', desc: 'External Access' },
  { name: 'Gadgets', emoji: '🔧', desc: 'Plugins' },
];

export const HomePage = () => {
  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-sm">Now with Theme Forge & Plugin System</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6">
              One App to{' '}
              <span className="gradient-text">Rule Them All</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              WatchNexus is a unified, self-hosted media pipeline that replaces 
              Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin.
              Request, acquire, organize, and watch — all in one place.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/download"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity animate-pulse-glow"
              >
                <Download className="w-5 h-5" />
                Download Now
              </Link>
              <Link
                to="/demo"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-colors"
              >
                <Play className="w-5 h-5" />
                See in Action
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 mt-12 text-center">
              <div>
                <p className="text-3xl font-bold gradient-text">13+</p>
                <p className="text-gray-500 text-sm">Modules</p>
              </div>
              <div>
                <p className="text-3xl font-bold gradient-text">6</p>
                <p className="text-gray-500 text-sm">Built-in Themes</p>
              </div>
              <div>
                <p className="text-3xl font-bold gradient-text">3</p>
                <p className="text-gray-500 text-sm">Platforms</p>
              </div>
              <div>
                <p className="text-3xl font-bold gradient-text">∞</p>
                <p className="text-gray-500 text-sm">Possibilities</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need, <span className="gradient-text">Nothing You Don't</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Stop juggling multiple applications. WatchNexus consolidates your entire media workflow.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl glass hover:border-violet-500/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section className="py-20 bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Modular Architecture, <span className="gradient-text">Food Theme</span> 🍯
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Each module is independently developed and can be extended with plugins.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {modules.map((module, index) => (
              <motion.div
                key={module.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-xl glass text-center hover:scale-105 transition-transform"
              >
                <span className="text-3xl">{module.emoji}</span>
                <p className="font-semibold mt-2">{module.name}</p>
                <p className="text-gray-500 text-xs mt-1">{module.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl glass gradient-border"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-gray-400 mb-8">
              Download WatchNexus for your platform and take control of your media.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/download"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-semibold"
              >
                <Download className="w-5 h-5" />
                Download for Free
              </Link>
              <Link
                to="/demo"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-colors"
              >
                Try the Demo
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
