import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, XCircle, AlertCircle, RefreshCw, 
  Server, Wifi, ChevronRight, Sparkles, Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { compoteApi } from '../../services/api';

export const IndexerHealthCheck = ({ indexers = [], onRefresh }) => {
  const [healthStatus, setHealthStatus] = useState({});
  const [checking, setChecking] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const runHealthCheck = async () => {
    setChecking(true);
    const status = {};
    
    for (const indexer of indexers) {
      if (indexer.enabled) {
        try {
          const res = await compoteApi.testIndexer(indexer.id);
          status[indexer.id] = {
            success: res.data?.success || false,
            message: res.data?.message || res.data?.error || 'Unknown',
            cloudflare: res.data?.cloudflare_detected || false,
          };
        } catch (err) {
          status[indexer.id] = {
            success: false,
            message: err.response?.data?.detail || 'Connection failed',
            cloudflare: false,
          };
        }
      }
    }
    
    setHealthStatus(status);
    setChecking(false);
  };

  const enabledIndexers = indexers.filter(i => i.enabled);
  const healthyCount = Object.values(healthStatus).filter(s => s.success).length;
  const hasIssues = enabledIndexers.length > 0 && healthyCount < enabledIndexers.length;

  return (
    <div className="space-y-4">
      {/* Health Overview Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              enabledIndexers.length === 0 ? 'bg-yellow-500/20 text-yellow-400' :
              healthyCount === enabledIndexers.length ? 'bg-green-500/20 text-green-400' :
              healthyCount > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {enabledIndexers.length === 0 ? (
                <AlertCircle className="w-6 h-6" />
              ) : healthyCount === enabledIndexers.length ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="font-bold">Indexer Status</h3>
              {enabledIndexers.length === 0 ? (
                <p className="text-sm text-yellow-400">No indexers enabled - searches will show demo results</p>
              ) : (
                <p className="text-sm text-gray-400">
                  {healthyCount}/{enabledIndexers.length} indexers healthy
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={runHealthCheck}
              disabled={checking || enabledIndexers.length === 0}
              className="border-violet-500/30"
            >
              {checking ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              <span className="ml-2">Test All</span>
            </Button>
            {enabledIndexers.length === 0 && (
              <Button 
                size="sm"
                onClick={() => setShowWizard(true)}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Setup Guide
              </Button>
            )}
          </div>
        </div>

        {/* Individual status */}
        {Object.keys(healthStatus).length > 0 && (
          <div className="mt-4 space-y-2">
            {enabledIndexers.map(indexer => {
              const status = healthStatus[indexer.id];
              if (!status) return null;
              
              return (
                <div 
                  key={indexer.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    status.success ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {status.success ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="font-medium text-sm">{indexer.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{status.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Setup Wizard Modal */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowWizard(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-violet-600/20 to-purple-600/20">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-violet-400" />
                  Indexer Setup Guide
                </h2>
                <p className="text-gray-400 mt-1">Get your media search working in 2 minutes</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold shrink-0">1</div>
                  <div>
                    <h3 className="font-bold">Enable a Torrent Indexer</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Click "Add Indexer" above and choose from the quick-add presets like <span className="text-violet-400">YTS</span> (movies) or <span className="text-violet-400">EZTV</span> (TV shows).
                    </p>
                    <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm text-green-400 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        YTS is recommended for beginners - it works without any API key
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold shrink-0">2</div>
                  <div>
                    <h3 className="font-bold">Test the Connection</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      After adding an indexer, click the <span className="text-violet-400">wifi icon</span> to test connectivity. If it fails, try enabling "Cloudflare Protected" in advanced options.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold shrink-0">3</div>
                  <div>
                    <h3 className="font-bold">Search for Media</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Go to any movie or show page and click "Download". WatchNexus will search all enabled indexers and show available torrents.
                    </p>
                  </div>
                </div>

                {/* Tip */}
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <h4 className="font-medium text-blue-400 mb-2">Pro Tip: Multiple Indexers</h4>
                  <p className="text-sm text-blue-300">
                    Adding multiple indexers increases your chances of finding content. Each indexer specializes in different types of media. For example, use Nyaa for anime and EZTV for TV shows.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
                <Button onClick={() => setShowWizard(false)} className="bg-violet-600 hover:bg-violet-700">
                  Got It!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
