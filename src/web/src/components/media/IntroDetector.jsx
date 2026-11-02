import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';

const API_URL = BACKEND_URL;

// Statuses that mean "this server has no intro-detection backend" rather than a real failure.
const UNAVAILABLE_STATUSES = new Set([404, 405, 501]);
const isUnavailable = (err) => UNAVAILABLE_STATUSES.has(err?.response?.status);

/**
 * Intro/credits detection trigger. The core backend currently only exposes
 * GET /api/system/chromaprint-status; the analyze endpoints may not exist.
 * This component therefore degrades silently: it renders nothing unless
 * Chromaprint is reported as installed, and if the analyze endpoint is missing
 * (404/405/501) it shows a disabled hint instead of erroring.
 */
export const IntroDetector = ({ seriesName, onDetectionComplete }) => {
  const [available, setAvailable] = useState(null); // null = checking, true, false
  const [unsupported, setUnsupported] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState(null); // null, 'success', 'error', 'no-intros'
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    axios.get(`${API_URL}/api/system/chromaprint-status`)
      .then((res) => { if (mountedRef.current) setAvailable(!!res?.data?.installed); })
      .catch(() => { if (mountedRef.current) setAvailable(false); });
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDetect = async () => {
    if (!seriesName || unsupported) return;

    setDetecting(true);
    setStatus(null);

    try {
      const encodedName = encodeURIComponent(seriesName);
      const res = await axios.post(`${API_URL}/api/marmalade/series/${encodedName}/analyze-intros`, {});
      if (!mountedRef.current) return;

      if (res?.data?.success) {
        toast.success(`Analyzing ${res.data.episodes_queued ?? 0} episodes for intro/credits detection`);
        setStatus('success');

        timerRef.current = setTimeout(async () => {
          try {
            const statusRes = await axios.get(`${API_URL}/api/marmalade/series/${encodedName}/intro-status`);
            if (!mountedRef.current) return;
            if (statusRes?.data?.with_segments > 0) {
              toast.success(`Detected skip segments in ${statusRes.data.with_segments} episodes!`);
              onDetectionComplete?.();
            } else {
              setStatus('no-intros');
              toast.info('No repeated intro/credits patterns found. Try again with more episodes.');
            }
          } catch {
            // Status endpoint is optional; stay quiet.
          }
        }, 10000);
      } else {
        toast.error(res?.data?.message || 'Failed to start detection');
        setStatus('error');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (isUnavailable(err)) {
        setUnsupported(true);
      } else {
        toast.error(err?.response?.data?.detail || 'Failed to detect intros');
        setStatus('error');
      }
    } finally {
      if (mountedRef.current) setDetecting(false);
    }
  };

  if (!available) return null;

  return (
    <div className="relative">
      <Button
        onClick={handleDetect}
        disabled={detecting || unsupported}
        variant="outline"
        className="border-violet-500/30 hover:bg-violet-500/10 gap-2"
        data-testid="detect-intros-btn"
        title={unsupported ? 'Intro detection is not available on this server' : undefined}
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

      {unsupported && (
        <p className="mt-1 text-xs text-gray-500" data-testid="detect-intros-unavailable">
          Intro detection is not available on this server.
        </p>
      )}

      {/* Tooltip explanation */}
      <AnimatePresence>
        {!detecting && !unsupported && status === null && (
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
