import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Film, CheckCircle2, AlertTriangle, RefreshCw, Copy, Loader2, ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

const API = BACKEND_URL;

/**
 * FFmpeg Settings — single-pane diagnostic panel.
 *
 * Lets the user:
 *   • See whether ffmpeg/ffprobe are detected, where they live, what version.
 *   • Re-probe after installing (no service restart required — server
 *     resets its locator cache on every status call).
 *   • Copy the locale-appropriate install command to clipboard.
 *   • Override the path manually via env var (documented inline).
 */
export const FFmpegSettings = () => {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);

  const probe = useCallback(async () => {
    setChecking(true);
    try {
      const token = (() => { try { return localStorage.getItem('token'); } catch { return null; } })();
      const res = await axios.get(`${API}/api/crucible/ffmpeg-status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setStatus(res.data);
    } catch (err) {
      setStatus({ ffmpeg_installed: false, error: err.message });
      toast.error('Could not reach /api/crucible/ffmpeg-status');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { probe(); }, [probe]);

  const installed = !!status?.ffmpeg_installed;
  const probeInstalled = !!status?.ffprobe_installed;
  const hint = status?.install_hint;

  const copy = () => {
    if (!hint) return;
    try {
      navigator.clipboard.writeText(hint);
      setCopied(true);
      toast.success('Install command copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  return (
    <div data-testid="ffmpeg-settings">
      <SettingsTabHeader
        icon={Film}
        title="FFmpeg"
        description="Media transcoding, playback, repair and disc-ripping all depend on FFmpeg. This panel checks whether it's installed and where."
      />

      <SettingsTabContent>
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-5 max-w-2xl"
        >
          {/* Status card */}
          <div className={`rounded-2xl p-5 border ${
            checking
              ? 'bg-white/[0.03] border-white/10'
              : installed
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-amber-500/5 border-amber-500/30'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                checking ? 'bg-white/5' : installed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
              }`}>
                {checking
                  ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  : installed
                    ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    : <AlertTriangle className="w-6 h-6 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-lg">
                  {checking ? 'Probing...' : installed ? 'FFmpeg detected' : 'FFmpeg not installed'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {checking
                    ? 'Searching env override, bundled tools, PATH, and common install dirs...'
                    : installed
                      ? 'Transcoding, repair and disc-ripping are operational.'
                      : "Modules that depend on FFmpeg will return 503 until it's installed."}
                </p>
              </div>
              <Button onClick={probe} disabled={checking} variant="outline"
                className="shrink-0 bg-white/5 border-white/10 text-white hover:bg-white/10"
                data-testid="ffmpeg-recheck-btn">
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" /> Re-check</>}
              </Button>
            </div>
          </div>

          {/* Detection details */}
          {!checking && status && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
              <DetectionRow label="ffmpeg binary"   installed={installed}      path={status.ffmpeg_path}  />
              <DetectionRow label="ffprobe binary"  installed={probeInstalled} path={status.ffprobe_path} />

              {status.ffmpeg_version && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Version</p>
                  <p className="text-xs text-gray-300 font-mono break-all">{status.ffmpeg_version}</p>
                </div>
              )}

              {status.hw_accel && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Supported hardware acceleration</p>
                  <div className="flex flex-wrap gap-2">
                    {status.hw_accel.map((h) => (
                      <span key={h} className="text-xs px-2 py-1 rounded-md bg-violet-500/20 text-violet-300 font-mono">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Install instructions */}
          {!checking && !installed && hint && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
              <p className="text-amber-200 text-sm font-medium mb-3">Install on this system:</p>
              <div className="flex items-center gap-2 bg-black/40 border border-amber-500/20 rounded-lg p-3">
                <code className="flex-1 text-amber-100 text-sm font-mono break-all">{hint}</code>
                <button onClick={copy} className="shrink-0 p-2 hover:bg-amber-500/10 rounded-md transition-colors"
                  data-testid="ffmpeg-copy-cmd">
                  {copied
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <Copy className="w-4 h-4 text-amber-300" />}
                </button>
              </div>
              <p className="text-xs text-amber-300/70 mt-3">
                After installing, click <strong>Re-check</strong>. WatchNexus does not need a restart.
              </p>
            </div>
          )}

          {/* Manual override docs */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <h4 className="text-white font-semibold mb-2">Manual override</h4>
            <p className="text-sm text-gray-400 mb-3">
              If FFmpeg is installed somewhere unusual, set these env vars before starting WatchNexus:
            </p>
            <pre className="bg-black/40 border border-white/5 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto">
{`WATCHNEXUS_FFMPEG_PATH=/full/path/to/ffmpeg
WATCHNEXUS_FFPROBE_PATH=/full/path/to/ffprobe`}
            </pre>
            <a
              href="https://ffmpeg.org/download.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-violet-400 hover:text-violet-300"
            >
              FFmpeg downloads <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </SettingsTabContent>
    </div>
  );
};

const DetectionRow = ({ label, installed, path }) => (
  <div className="flex items-center gap-3">
    {installed
      ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      : <div className="w-5 h-5 rounded-full border-2 border-amber-500/50 shrink-0" />}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-white font-medium">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          installed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {installed ? 'detected' : 'not found'}
        </span>
      </div>
      {path && <p className="text-xs text-gray-500 font-mono truncate" title={path}>{path}</p>}
    </div>
  </div>
);

export default FFmpegSettings;
