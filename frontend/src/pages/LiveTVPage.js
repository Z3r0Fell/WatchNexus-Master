import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Radio, Construction } from 'lucide-react';

export const LiveTVPage = () => {
  return (
    <Layout>
      <div data-testid="live-tv-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Live TV</h1>
              <p className="text-gray-400">IPTV and live streams</p>
            </div>
          </div>
        </motion.div>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-6">
            <Construction className="w-12 h-12 text-gray-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Coming Soon</h2>
          <p className="text-gray-400 text-center max-w-md">
            Live TV support is under development. Soon you'll be able to watch 
            IPTV channels, set up DVR recordings, and manage your live streams.
          </p>
          
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Channels', 'Guide', 'Recordings', 'IPTV'].map((feature) => (
              <div
                key={feature}
                className="p-4 rounded-xl bg-white/5 border border-white/10 text-center"
              >
                <p className="text-sm text-gray-400">{feature}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
