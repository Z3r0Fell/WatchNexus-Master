import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Podcast, Plus, Search, Play, Clock, Rss, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

const PodcastsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');

  const handleSubscribe = () => {
    if (!feedUrl) return toast.error('Enter an RSS feed URL');
    toast.success('Podcast subscription added');
    setSubscriptions(p => [...p, { name: 'New Podcast', url: feedUrl, episodes: 0 }]);
    setFeedUrl(''); setShowAdd(false);
  };

  return (
    <Layout>
      <div data-testid="podcasts-page" className="min-h-screen p-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <Podcast className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Podcasts</h1>
                <p className="text-gray-400">{subscriptions.length} subscriptions</p>
              </div>
            </div>
            <Button onClick={() => setShowAdd(!showAdd)} className="bg-orange-600 hover:bg-orange-700" data-testid="add-podcast">
              <Plus className="w-4 h-4 mr-2" /> Subscribe
            </Button>
          </div>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4 mt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Rss className="w-4 h-4" /> Add RSS Feed</h3>
              <div className="flex gap-3">
                <Input placeholder="https://example.com/feed.xml" value={feedUrl} onChange={e => setFeedUrl(e.target.value)}
                  className="bg-white/5 border-white/10 flex-1" data-testid="podcast-feed-input" />
                <Button onClick={handleSubscribe} className="bg-green-600 hover:bg-green-700">Subscribe</Button>
              </div>
            </motion.div>
          )}
        </motion.div>
        {subscriptions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-orange-600/20 flex items-center justify-center mb-6">
              <FolderOpen className="w-12 h-12 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Podcast Subscriptions</h2>
            <p className="text-gray-400 text-center max-w-md mb-6">
              Subscribe to your favorite podcasts via RSS feeds. New episodes will be auto-downloaded and ready to listen.
            </p>
            <Button onClick={() => setShowAdd(true)} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" /> Add Your First Podcast
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PodcastsPage;
