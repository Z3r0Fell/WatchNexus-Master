import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Music, Construction } from 'lucide-react';

export const MusicPage = () => {
  return (
    <Layout>
      <div data-testid="music-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-orange-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Music</h1>
              <p className="text-gray-400">Your music library and music videos</p>
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
            Music library support is under development. Soon you'll be able to manage your 
            music collection, music videos, and concert recordings.
          </p>
          
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Albums', 'Artists', 'Playlists', 'Music Videos'].map((feature) => (
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
