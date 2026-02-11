import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, HelpCircle } from 'lucide-react';

const faqCategories = [
  {
    name: 'General',
    faqs: [
      {
        q: 'What is WatchNexus?',
        a: 'WatchNexus is a unified, self-hosted media pipeline that combines the functionality of Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin into a single application. It handles requesting, acquiring, organizing, and watching media all in one place.'
      },
      {
        q: 'Is WatchNexus free?',
        a: 'Yes! WatchNexus is completely free and open source under the MIT License. You can download, use, modify, and distribute it freely.'
      },
      {
        q: 'What platforms are supported?',
        a: 'WatchNexus runs on Windows 10/11, macOS (Monterey and later), and Linux (Ubuntu, Fedora, Arch, Debian). Docker images are also available for any platform that supports Docker.'
      },
      {
        q: 'Do I need technical knowledge to use WatchNexus?',
        a: 'Basic computer skills are sufficient for installation and daily use. The UI is designed to be intuitive. However, some advanced features like custom indexers or Docker deployment may require more technical knowledge.'
      },
      {
        q: 'What makes WatchNexus different from existing solutions?',
        a: 'Unlike traditional setups that require multiple applications (Sonarr + Radarr + Prowlarr + qBittorrent + Bazarr + Jellyfin), WatchNexus is a single, unified application. This means easier setup, unified UI, and no need to configure communication between multiple apps.'
      }
    ]
  },
  {
    name: 'Features',
    faqs: [
      {
        q: 'What media types does WatchNexus support?',
        a: 'WatchNexus supports movies, TV shows, music, audiobooks, and IPTV/live TV. The Marmalade media server handles playback for all supported formats.'
      },
      {
        q: 'What is a Watch Party (Potluck)?',
        a: 'Potluck is our synchronized viewing feature. Create a party, share the 6-character code with friends, and watch together in perfect sync with live chat and emoji reactions.'
      },
      {
        q: 'How does remote access work (Gelatin)?',
        a: 'Gelatin enables secure remote access to your WatchNexus server. You can access your media library from anywhere via LAN discovery, or create secure tunnels for external access.'
      },
      {
        q: 'Can I customize the appearance?',
        a: 'Yes! The Milk theme engine includes 6 built-in themes, and the Theme Forge lets you create custom themes. The Juice color picker provides full control over accent colors.'
      },
      {
        q: 'What subtitle sources are supported?',
        a: 'The Garnish module supports Addic7ed and OpenSubtitles. Configure your preferred languages, and subtitles can be automatically downloaded when available.'
      },
      {
        q: 'Can I add plugins/extensions?',
        a: 'Yes! The Gadgets plugin system allows you to extend WatchNexus with custom functionality. Check the plugins directory for available extensions.'
      }
    ]
  },
  {
    name: 'Downloads & Indexers',
    faqs: [
      {
        q: 'How does the built-in download client work?',
        a: 'The Fondue torrent engine is a built-in libtorrent-based client. It handles all torrent downloads natively without needing external applications like qBittorrent.'
      },
      {
        q: 'What indexers are supported?',
        a: 'The Syrup indexer aggregator includes built-in scrapers for popular sites like 1337x, YTS, and EZTV. The Compote module also supports custom Torznab and RSS feeds.'
      },
      {
        q: 'Can I use my own indexers?',
        a: 'Absolutely! Add custom Torznab-compatible indexers or RSS feeds through the Settings > Indexers tab. The Compote module manages all indexer configurations.'
      },
      {
        q: 'Does WatchNexus support Usenet?',
        a: 'The Pulp module is designed for Usenet/NZB handling. While basic functionality is in place, full Usenet support is still being developed.'
      },
      {
        q: 'How does Cloudflare bypass work?',
        a: 'The Preserve module handles anti-bot challenges automatically. When accessing protected sites, Preserve attempts to solve Cloudflare and similar challenges.'
      }
    ]
  },
  {
    name: 'Technical',
    faqs: [
      {
        q: 'What are the system requirements?',
        a: 'Minimum: 2 CPU cores, 4GB RAM, 500MB storage (plus media storage). Recommended: 4+ cores, 8GB RAM for smooth streaming and transcoding.'
      },
      {
        q: 'What database does WatchNexus use?',
        a: 'WatchNexus uses MongoDB for data storage. The database is automatically configured during installation.'
      },
      {
        q: 'Can I run WatchNexus in Docker?',
        a: 'Yes! Official Docker images are available on Docker Hub. This is the recommended method for NAS devices and servers.'
      },
      {
        q: 'How do I backup my data?',
        a: 'Your configuration is stored in the config directory (location varies by platform). Backup this folder along with your media library for a complete backup.'
      },
      {
        q: 'What ports does WatchNexus use?',
        a: 'By default: Port 3000 for the web UI and Port 8001 for the backend API. These can be configured in the settings or via environment variables.'
      },
      {
        q: 'Is hardware transcoding supported?',
        a: 'The Marmalade server supports basic transcoding. Hardware acceleration via VAAPI/NVENC is planned for future releases.'
      }
    ]
  },
  {
    name: 'Streaming Services',
    faqs: [
      {
        q: 'What streaming services can I connect?',
        a: 'WatchNexus supports credentials for Netflix, Disney+, Amazon Prime Video, Crunchyroll, YouTube, HBO Max, Hulu, Peacock, Paramount+, Apple TV+, and Funimation.'
      },
      {
        q: 'How are my streaming credentials stored?',
        a: 'Credentials are encrypted using industry-standard encryption before storage. They are only decrypted when needed for deep linking to the service.'
      },
      {
        q: 'Does WatchNexus download from streaming services?',
        a: 'No. WatchNexus stores your credentials for quick access/deep linking to streaming content. It does not download or bypass DRM from streaming services.'
      }
    ]
  },
  {
    name: 'Legal & Privacy',
    faqs: [
      {
        q: 'Is WatchNexus legal?',
        a: 'WatchNexus itself is legal software. It\'s a media management tool similar to Plex or Jellyfin. How you use it—specifically what content you download—is your responsibility.'
      },
      {
        q: 'Does WatchNexus collect my data?',
        a: 'No. WatchNexus is fully self-hosted and does not phone home or collect any analytics. Your data stays on your server.'
      },
      {
        q: 'What license is WatchNexus under?',
        a: 'WatchNexus is released under the MIT License, one of the most permissive open-source licenses. You can use, modify, and distribute it freely.'
      }
    ]
  }
];

export const FAQPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');

  const toggleItem = (categoryIndex, faqIndex) => {
    const key = `${categoryIndex}-${faqIndex}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredCategories = faqCategories
    .filter(cat => selectedCategory === 'all' || cat.name === selectedCategory)
    .map(cat => ({
      ...cat,
      faqs: cat.faqs.filter(faq =>
        searchQuery === '' ||
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(cat => cat.faqs.length > 0);

  return (
    <div className="pt-24 pb-16" data-testid="faq-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Find answers to common questions about WatchNexus
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="faq-search"
              className="w-full pl-12 pr-4 py-4 rounded-xl glass bg-surface/50 border border-white/10 focus:border-violet-500/50 focus:outline-none text-white placeholder-gray-500"
            />
          </div>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {faqCategories.map(cat => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === cat.name
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                  : 'glass text-gray-400 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </motion.div>

        {/* FAQ List */}
        <div className="space-y-8">
          {filteredCategories.map((category, catIndex) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIndex * 0.05 }}
            >
              <h2 className="text-xl font-bold mb-4 text-violet-400">{category.name}</h2>
              <div className="space-y-3">
                {category.faqs.map((faq, faqIndex) => {
                  const key = `${catIndex}-${faqIndex}`;
                  const isOpen = openItems[key];
                  
                  return (
                    <div
                      key={faqIndex}
                      className="rounded-xl glass overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItem(catIndex, faqIndex)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                        data-testid={`faq-item-${catIndex}-${faqIndex}`}
                      >
                        <span className="font-medium pr-4">{faq.q}</span>
                        <ChevronDown 
                          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-5 pb-5 text-gray-400 border-t border-white/5 pt-4">
                              {faq.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* No Results */}
        {filteredCategories.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-400">No FAQs found matching your search.</p>
          </motion.div>
        )}

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 p-8 rounded-2xl glass text-center"
        >
          <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
          <p className="text-gray-400 mb-6">
            Can't find what you're looking for? Check out our troubleshooting guide or join the community.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="/troubleshooting"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-medium"
            >
              Troubleshooting Guide
            </a>
            <a
              href="https://github.com/watchnexus/watchnexus/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
            >
              GitHub Discussions
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
