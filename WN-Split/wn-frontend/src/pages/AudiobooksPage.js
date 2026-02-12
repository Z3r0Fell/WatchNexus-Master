import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { BookOpen, Construction } from 'lucide-react';

export const AudiobooksPage = () => {
  return (
    <Layout>
      <div data-testid="audiobooks-page" className="min-h-screen p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-500 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Audiobooks</h1>
              <p className="text-gray-400">Your audiobook library</p>
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
            Audiobook support is under development. Soon you'll be able to manage your 
            audiobook collection with bookmarks, chapter navigation, and listening progress.
          </p>
          
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Library', 'Authors', 'Narrators', 'Progress'].map((feature) => (
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
