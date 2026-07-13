import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';

const API_URL = BACKEND_URL;

export const IntroDetector = ({ seriesName, onDetectionComplete }) => {
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState(null); // null, 'success', 'error', 'no-intros'

  const handleDetect = async () => {
    if (!seriesName) {
      toast.error('Series name is required');
      return;
    }

    setDetecting(true);
    setStatus(null);

    try {
      const encodedName = encodeURIComponent(seriesName);
      
      const res = await axios.post(
        `${API_URL}/api/marmalade/series/${encodedName}/analyze-intros`,
        {},
        {  }
      );

      if (res.data.success) {
        toast.success(`Analyzing ${res.data.episodes_queued} episodes for intro/credits detection`);
        setStatus('success');
        
        // Check status after a delay
        setTimeout(async () => {
          try {
            const statusRes = await axios.get(
              `${API_URL}/api/marmalade/series/${encodedName}/intro-status`,
              {  }
            );
            
            if (statusRes.data.with_segments > 0) {
              toast.success(`Detected skip segments in ${statusRes.data.with_segments} episodes!`);
              onDetectionComplete?.();
            } else {
              setStatus('no-intros');
              toast.info('No repeated intro/credits patterns found. Try again with more episodes.');
            }
          } catch (e) {
            console.error('Failed to check status:', e);
          }
        }, 10000); // Check after 10 seconds
        
      } else {
        toast.error(res.data.message || 'Failed to start detection');
        setStatus('error');
      }
    } catch (err) {
      console.error('Intro detection error:', err);
      toast.error(err.response?.data?.detail || 'Failed to detect intros');
      setStatus('error');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="relative">
      <Button
        onClick={handleDetect}
        disabled={detecting}
        variant="outline"
        className="border-violet-500/30 hover:bg-violet-500/10 gap-2"
        data-testid="detect-intros-btn"
      >
        {detecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Detecting...</span>
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Analyzing...</span>
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>Retry Detection</span>
          </>
        ) : (
          <>
            <Fingerprint className="w-4 h-4" />
            <span>Detect Intros</span>
          </>
        )}
      </Button>

      {/* Tooltip explanation */}
      <AnimatePresence>
        {!detecting && status === null && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-full left-0 mt-2 w-64 p-3 bg-black/90 rounded-lg border border-white/10 text-xs z-10 hidden group-hover:block"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">AI Intro Detection</p>
                <p className="text-gray-400 mt-1">
                  Uses audio fingerprinting to find repeated segments (like opening themes) across episodes.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntroDetector;
