import { BACKEND_URL } from '../lib/config';
import { Component, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { marmaladeMedia, marmaladeProgress, marmaladeStream, formatDuration, formatResolution } from '../services/marmaladeApi';
import axios from 'axios';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, ArrowLeft, Check,
  RefreshCw, AlertTriangle, Subtitles, Download, X,
  Languages, ChevronRight, FastForward, Film, Tv
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';
import { toast } from 'sonner';

const API_URL = BACKEND_URL;

// Skip segment types
const SKIP_TYPES = {
  INTRO: 'intro',
  CREDITS: 'credits',
  RECAP: 'recap',
  PREVIEW: 'preview',
};

// Turn an axios/fetch failure into a message a user can act on.
const describeLoadError = (err, fallback) => {
  const status = err?.response?.status;
  if (status === 404) return 'This item was not found in your library — it may have been removed or rescanned';
  if (status === 401 || status === 403) return 'You are not authorised to play this item';
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  return fallback;
};

// Convert SRT (or pass through WebVTT) to WebVTT for the <track> element.
export const toWebVtt = (text) => {
  const body = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (/^WEBVTT/.test(body)) return body;
  return 'WEBVTT\n\n' + body.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
};

const VTT_TS = '(?:(\\d+):)?(\\d{2}):(\\d{2})\\.(\\d{3})';
const VTT_TIMING = new RegExp(`^${VTT_TS}\\s+-->\\s+${VTT_TS}(.*)$`);
const vttSeconds = (h, m, s, ms) => (Number(h || 0) * 3600) + Number(m) * 60 + Number(s) + Number(ms) / 1000;
const formatVttTime = (t) => {
  const total = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const ms = total % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(ms, 3)}`;
};

// Shift every cue in a WebVTT document by `seconds` (positive = later). Used for
// the user's sync adjustment and to re-base cues when a transcoded stream is
// restarted at an offset (its media time starts again at 0). Cues that end
// before 0 are dropped; cues straddling 0 are clamped.
export const shiftVtt = (vtt, seconds) => {
  if (!seconds) return vtt;
  const out = [];
  const blocks = String(vtt).split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const idx = lines.findIndex((l) => VTT_TIMING.test(l));
    if (idx === -1) { out.push(block); continue; }
    const m = lines[idx].match(VTT_TIMING);
    const start = vttSeconds(m[1], m[2], m[3], m[4]) + seconds;
    const end = vttSeconds(m[5], m[6], m[7], m[8]) + seconds;
    if (end <= 0) continue;
    lines[idx] = `${formatVttTime(start)} --> ${formatVttTime(end)}${m[9] || ''}`;
    out.push(lines.join('\n'));
  }
  return out.join('\n\n');
};

// Transcoded streams seek server-side: reopen the stream at ?start=<seconds>.
export const transcodeSrcAt = (base, start) => {
  if (!base) return '';
  if (!(start > 0)) return base;
  return `${base}${base.includes('?') ? '&' : '?'}start=${start.toFixed(2)}`;
};

const PlaybackErrorScreen = ({ message, onBack }) => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white" data-testid="video-error">
    <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
    <h2 className="text-xl font-bold mb-2">Playback Error</h2>
    <p className="text-gray-400 mb-4 text-center px-6">{message || 'Media not found'}</p>
    <Button data-testid="video-error-back-btn" onClick={onBack} variant="outline">
      <ArrowLeft className="w-4 h-4 mr-2" />
      Go Back
    </Button>
  </div>
);

const PlayerInner = () => {
  const { mediaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressInterval = useRef(null);
  const trackRef = useRef(null);
  const skipButtonTimeout = useRef(null);
  
  const [media, setMedia] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const controlsTimeout = useRef(null);

  // Playback delivery. Direct play serves the file as-is (seekable via byte
  // ranges). Transcoded streams come from ffmpeg and aren't byte-seekable, so
  // seeking reopens the stream at an offset and `streamOffset` holds the
  // absolute media time the current stream started at.
  const [playback, setPlayback] = useState(null); // result of marmaladeStream.authorizePlayback
  const [streamOffset, setStreamOffset] = useState(0);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const transcodedRef = useRef(false);
  const transcodeBaseRef = useRef(null);
  const offsetRef = useRef(0);
  const pendingPlayRef = useRef(false);
  const resumeAtRef = useRef(0);
  const fallbackTriedRef = useRef(false);
  const durationRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // Absolute position in the media, whichever way it's being delivered.
  const getAbsTime = useCallback(
    () => offsetRef.current + (videoRef.current?.currentTime || 0),
    []
  );

  const startTranscodeAt = useCallback((start, { autoplay } = {}) => {
    const t = Math.max(0, start || 0);
    transcodedRef.current = true;
    setIsTranscoding(true);
    offsetRef.current = t;
    setStreamOffset(t);
    pendingPlayRef.current = !!autoplay;
    setCurrentTime(t);
    setStreamUrl(transcodeSrcAt(transcodeBaseRef.current, t));
  }, []);

  // Advanced playback controls
  const [skipSegments, setSkipSegments] = useState([]); // {type, start, end}
  const [currentSkipSegment, setCurrentSkipSegment] = useState(null);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [nextEpisode, setNextEpisode] = useState(null);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(null);

  // Subtitle state
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState(null);
  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const [searchingSubtitles, setSearchingSubtitles] = useState(false);
  const [subtitleOffset, setSubtitleOffset] = useState(0); // ms offset
  const [subtitleSize, setSubtitleSize] = useState(100); // % of default size

  // Settings menu state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('subtitles');

  // Refs to avoid stale closures in keyboard handler
  const volumeRef = useRef(volume);
  const fullscreenRef = useRef(fullscreen);
  const showSubtitleMenuRef = useRef(showSubtitleMenu);
  const subtitleOffsetToastRef = useRef(null);
  const subtitleOffsetTimerRef = useRef(null);
  const showSettingsRef = useRef(showSettings);
  const subtitleOffsetRef = useRef(subtitleOffset);
  const subtitlesEnabledRef = useRef(subtitlesEnabled);

  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { fullscreenRef.current = fullscreen; }, [fullscreen]);
  useEffect(() => { showSubtitleMenuRef.current = showSubtitleMenu; }, [showSubtitleMenu]);
  useEffect(() => { showSettingsRef.current = showSettings; }, [showSettings]);
  useEffect(() => { subtitleOffsetRef.current = subtitleOffset; }, [subtitleOffset]);
  useEffect(() => { subtitlesEnabledRef.current = subtitlesEnabled; }, [subtitlesEnabled]);

  // Fetch media info
  useEffect(() => {
    let ignore = false;
    const fetchMedia = async () => {
      setLoading(true);
      setError(null);
      setMedia(null);
      setStreamUrl('');
      setPlayback(null);
      setStreamOffset(0);
      setIsTranscoding(false);
      setDuration(0);
      transcodedRef.current = false;
      transcodeBaseRef.current = null;
      offsetRef.current = 0;
      pendingPlayRef.current = false;
      resumeAtRef.current = 0;
      fallbackTriedRef.current = false;
      try {
        const res = await marmaladeMedia.getMediaItem(mediaId);
        if (ignore) return;
        const item = res?.data;
        // Guard against a non-JSON / unexpected payload (e.g. an HTML page
        // from a misrouted proxy) — never put a non-object into `media`.
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          setError('This item could not be loaded from your library');
          return;
        }
        setMedia(item);
        const progress = Number(item.watch_progress);
        const resumeAt = Number.isFinite(progress) && progress > 0 ? progress : 0;
        resumeAtRef.current = resumeAt;
        setCurrentTime(resumeAt);

        // Authorise playback — mints a short-lived signed stream URL and tells
        // us whether the browser can play the file directly or whether the
        // server has to convert it with ffmpeg.
        try {
          const pb = await marmaladeStream.authorizePlayback(mediaId);
          if (ignore) return;
          setPlayback(pb);
          if (pb.duration) setDuration(pb.duration);
          transcodeBaseRef.current = pb.transcodeUrl;
          if (pb.directPlay) {
            setStreamUrl(pb.streamUrl);
          } else {
            // Resume position is applied server-side for transcoded streams.
            resumeAtRef.current = 0;
            startTranscodeAt(resumeAt);
          }
        } catch (err) {
          if (ignore) return;
          console.error('Failed to authorize playback:', err);
          // The server explains why (e.g. "Media file not found on disk").
          const detail = err?.response?.data?.detail;
          setError(typeof detail === 'string' && detail ? detail : describeLoadError(err, 'Failed to authorize playback'));
          return;
        }

        // Optional extras — failures here must never block playback.
        fetchSkipSegments(mediaId, () => ignore);
        if (item.media_type === 'episode' || item.type === 'tv' || item.series_name) {
          fetchNextEpisode(item, () => ignore);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load media:', err);
          setError(describeLoadError(err, 'Failed to load media'));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    if (mediaId) {
      fetchMedia();
    } else {
      setError('No media selected');
      setLoading(false);
    }

    return () => { ignore = true; };
  }, [mediaId, startTranscodeAt]);

  // Fetch skip segments (intro, credits, etc.)
  const fetchSkipSegments = async (id, isIgnored = () => false) => {
    try {
      const res = await axios.get(`${API_URL}/api/marmalade/media/${id}/skip-segments`);
      const segments = res?.data?.segments;
      if (!isIgnored() && Array.isArray(segments)) {
        setSkipSegments(segments.filter(s => s && Number.isFinite(s.start) && Number.isFinite(s.end)));
      }
    } catch (err) {
      // Skip segments are optional - generate estimates based on duration
      console.log('No skip segments available, will estimate');
    }
  };

  // Fetch next episode in series
  const fetchNextEpisode = async (currentMedia, isIgnored = () => false) => {
    try {
      const res = await axios.get(`${API_URL}/api/marmalade/media/${currentMedia.id}/next-episode`);
      const next = res?.data;
      if (!isIgnored() && next && typeof next === 'object' && next.id) {
        setNextEpisode(next);
      }
    } catch (err) {
      // No next episode available
      console.log('No next episode found');
    }
  };

  // Monitor playback position for skip segments
  useEffect(() => {
    if (!playing || skipSegments.length === 0) return;

    const checkSkipSegment = () => {
      const time = getAbsTime();
      
      // Find if we're in a skippable segment
      const segment = skipSegments.find(s => time >= s.start && time < s.end);
      
      if (segment && !currentSkipSegment) {
        setCurrentSkipSegment(segment);
        setShowSkipButton(true);
        
        // Auto-hide skip button after 5 seconds
        if (skipButtonTimeout.current) clearTimeout(skipButtonTimeout.current);
        skipButtonTimeout.current = setTimeout(() => {
          setShowSkipButton(false);
        }, 5000);
      } else if (!segment && currentSkipSegment) {
        setCurrentSkipSegment(null);
        setShowSkipButton(false);
      }
    };

    const interval = setInterval(checkSkipSegment, 500);
    return () => clearInterval(interval);
  }, [playing, skipSegments, currentSkipSegment, getAbsTime]);

  // Check for credits/end of video for next episode prompt
  useEffect(() => {
    if (!playing || !duration || !nextEpisode) return;

    const checkEndCredits = () => {
      const time = getAbsTime();
      const timeRemaining = duration - time;
      
      // Show next episode prompt when less than 30 seconds remain
      if (timeRemaining <= 30 && timeRemaining > 0 && !showNextEpisode) {
        setShowNextEpisode(true);
        
        // Start countdown if auto-play is enabled
        if (autoPlayNext) {
          setNextEpisodeCountdown(Math.floor(timeRemaining));
        }
      }
    };

    const interval = setInterval(checkEndCredits, 1000);
    return () => clearInterval(interval);
  }, [playing, duration, nextEpisode, showNextEpisode, autoPlayNext, getAbsTime]);

  // Countdown timer for auto-play next episode
  useEffect(() => {
    if (nextEpisodeCountdown === null || nextEpisodeCountdown <= 0) return;

    const timer = setTimeout(() => {
      setNextEpisodeCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [nextEpisodeCountdown]);

  // Auto-play next episode when countdown reaches 0
  useEffect(() => {
    if (nextEpisodeCountdown === 0 && nextEpisode && autoPlayNext) {
      playNextEpisode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextEpisodeCountdown, nextEpisode, autoPlayNext]);

  // Skip to end of current segment
  const handleSkipSegment = () => {
    if (currentSkipSegment && videoRef.current) {
      seekTo(currentSkipSegment.end);
      setShowSkipButton(false);
      setCurrentSkipSegment(null);
      toast.success(`Skipped ${currentSkipSegment.type}`);
    }
  };

  // Play next episode
  const playNextEpisode = () => {
    if (nextEpisode) {
      navigate(`/watch/${nextEpisode.id}`);
    }
  };

  // Cancel next episode auto-play
  const cancelNextEpisode = () => {
    setShowNextEpisode(false);
    setNextEpisodeCountdown(null);
  };

  // Search for subtitles when media loads
  useEffect(() => {
    const searchSubtitles = async () => {
      if (!media) return;
      
      setSearchingSubtitles(true);
      try {
        // Determine if TV or movie
        const isTV = media.type === 'tv' || media.series_name;
        const endpoint = isTV ? '/api/subtitles/search/tv' : '/api/subtitles/search/movie';
        
        // Backend binds show_name / movie_name (SubtitlesController).
        const params = isTV ? {
          show_name: media.series_name || media.title,
          season: media.season_number || 1,
          episode: media.episode_number || 1,
        } : {
          movie_name: media.title,
          year: media.year,
        };
        
        const res = await axios.get(`${API_URL}${endpoint}`, {
          params,
        });
        
        if (Array.isArray(res?.data) && res.data.length > 0) {
          // /search/tv serialises the raw record (camelCase downloadUrl),
          // /search/movie uses download_url — normalise to download_url.
          setAvailableSubtitles(res.data
            .filter(sub => sub && typeof sub === 'object')
            .map(sub => ({ ...sub, download_url: sub.download_url ?? sub.downloadUrl })));
        }
      } catch (err) {
        console.error('Failed to search subtitles:', err);
      } finally {
        setSearchingSubtitles(false);
      }
    };
    
    searchSubtitles();
  }, [media]);

  // Load subtitle track
  const loadSubtitle = async (subtitle) => {
    try {
      // Download subtitle
      const res = await axios.post(`${API_URL}/api/subtitles/download`, {
        download_url: subtitle.download_url,
        media_id: mediaId,
      });
      
      // Backend returns either `path` (saved next to the media file) or
      // `data_base64` (inline). <track> only understands WebVTT, so the
      // (usually SRT) text is converted and served from a blob URL.
      let text = null;
      if (res.data?.data_base64) {
        const bin = atob(res.data.data_base64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        text = new TextDecoder('utf-8').decode(bytes);
      } else if (res.data?.path) {
        const fileRes = await axios.get(
          `${API_URL}/api/subtitles/file/${String(res.data.path).replace(/^\/+/, '')}`,
          { responseType: 'text', transformResponse: (d) => d }
        );
        text = fileRes.data;
      }
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Subtitle download returned no data');
      }
      // The <track> blob URL is derived from this text (see subtitleTrackUrl)
      // so the sync adjustment and transcode offset can re-time the cues.
      setCurrentSubtitle({ ...subtitle, vtt: toWebVtt(text) });
      setSubtitlesEnabled(true);
      toast.success(`Loaded: ${subtitle.language}`);
    } catch (err) {
      console.error('Failed to load subtitle:', err);
      toast.error('Failed to load subtitle');
    }
  };

  // Build the <track> source from the loaded subtitle, re-timed for the
  // user's sync adjustment (ms, + = later) and, for transcoded streams, the
  // offset the current stream started at (its media time restarts at 0).
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState(null);
  useEffect(() => {
    if (!currentSubtitle?.vtt || typeof URL.createObjectURL !== 'function') {
      setSubtitleTrackUrl(null);
      return undefined;
    }
    const shifted = shiftVtt(currentSubtitle.vtt, subtitleOffset / 1000 - streamOffset);
    const url = URL.createObjectURL(new Blob([shifted], { type: 'text/vtt' }));
    setSubtitleTrackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentSubtitle, subtitleOffset, streamOffset]);

  // Report progress periodically
  useEffect(() => {
    if (playing && media) {
      progressInterval.current = setInterval(() => {
        if (videoRef.current) {
          marmaladeProgress.updateProgress(mediaId, getAbsTime())
            .catch(err => console.error('Failed to update progress:', err));
        }
      }, 10000);
    }
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [playing, media, mediaId, getAbsTime]);

  // Hide controls after inactivity
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
    if (playing && !showSubtitleMenu && !showSettings) {
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [playing, showSubtitleMenu, showSettings]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;

    if (!transcodedRef.current) {
      if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
      // Resume once, for direct play only (transcoded streams start at the
      // resume point server-side).
      if (resumeAtRef.current > 0) {
        v.currentTime = resumeAtRef.current;
        resumeAtRef.current = 0;
      }
    } else if (!durationRef.current && Number.isFinite(v.duration) && v.duration > 0) {
      // Server couldn't probe a duration; best effort from the stream itself.
      setDuration(offsetRef.current + v.duration);
    }

    // Keep playing across a source switch (transcoded seek / fallback).
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => setPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(getAbsTime());
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    marmaladeProgress.markWatched(mediaId, true)
      .then(() => toast.success('Marked as watched'))
      .catch(err => console.error('Failed to mark watched:', err));
  };

  const handleWaiting = () => setBuffering(true);
  const handlePlaying = () => setBuffering(false);
  
  const handleError = (e) => {
    console.error('Video error:', e);
    // Try to determine specific error type
    const videoElement = videoRef.current;
    const errorCode = videoElement?.error?.code;

    // Direct play failed to decode (e.g. a codec the server probe thought was
    // fine, or ffprobe was unavailable): switch to the ffmpeg stream once,
    // from the current position.
    if ((errorCode === 3 || errorCode === 4) && !transcodedRef.current
        && transcodeBaseRef.current && !fallbackTriedRef.current) {
      fallbackTriedRef.current = true;
      const at = (videoElement?.currentTime || 0) || resumeAtRef.current || 0;
      resumeAtRef.current = 0;
      console.warn('Direct play failed; falling back to server transcode at', at);
      toast.info('Converting this video for your browser…');
      setBuffering(true);
      startTranscodeAt(at, { autoplay: playing });
      return;
    }

    if (videoElement?.error) {
      switch (errorCode) {
        case 2: // MediaError.MEDIA_ERR_NETWORK
          setError('Network error - media file may not exist or server is unreachable');
          break;
        case 3: // MediaError.MEDIA_ERR_DECODE
          setError(transcodedRef.current
            ? 'The converted video stream could not be decoded — check the server log for FFmpeg errors'
            : 'Media decoding error - file may be corrupted');
          break;
        case 4: // MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          if (transcodedRef.current) {
            setError('The server could not convert this video for playback — check that FFmpeg is installed and see the server log');
          } else if (!transcodeBaseRef.current) {
            setError('This video format is not supported by your browser, and FFmpeg is not available on the server to convert it. Install FFmpeg on the server (Settings → FFmpeg) and try again.');
          } else {
            setError('Media format not supported');
          }
          break;
        default:
          setError('Failed to play video - please verify the file exists');
      }
    } else {
      setError('Failed to play video - media file not found');
    }
    setBuffering(false);
  };

  // Controls
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
        setPlaying(false);
      } else {
        const p = videoRef.current.play();
        setPlaying(true);
        if (p && typeof p.catch === 'function') {
          p.catch((err) => {
            // AbortError = the source was swapped (transcoded seek / fallback);
            // the new source resumes via pendingPlayRef.
            if (err?.name === 'AbortError') return;
            setPlaying(false);
            // An unplayable source also fires the <video> `error` event, which
            // owns the messaging and the transcode fallback — only report here
            // when no fallback exists.
            if (err?.name === 'NotSupportedError' && (transcodedRef.current || !transcodeBaseRef.current)) {
              setError('Media format not supported by this browser');
            }
          });
        }
      }
    }
  }, [playing]);

  // Seek to an absolute media time. Direct play seeks the element; a
  // transcoded stream is reopened at the target time.
  const seekTo = useCallback((target) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(target)) return;
    const max = durationRef.current > 0 ? durationRef.current : Infinity;
    const t = Math.max(0, Math.min(max, target));
    if (transcodedRef.current) {
      setBuffering(true);
      startTranscodeAt(t, { autoplay: playing });
    } else {
      v.currentTime = t;
      setCurrentTime(t);
    }
  }, [playing, startTranscodeAt]);

  // While dragging, only move the thumb for transcoded streams (each reopen
  // starts a new ffmpeg process); commit the seek on release.
  const handleSeek = (value) => {
    if (transcodedRef.current) {
      setCurrentTime(value[0]);
    } else {
      seekTo(value[0]);
    }
  };

  const handleSeekCommit = (value) => {
    if (transcodedRef.current) seekTo(value[0]);
  };

  const handleVolumeChange = useCallback((value) => {
    if (videoRef.current) {
      const vol = value[0];
      videoRef.current.volume = vol;
      setVolume(vol);
      setMuted(vol === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  }, [muted]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  const skip = useCallback((seconds) => {
    seekTo(getAbsTime() + seconds);
  }, [seekTo, getAbsTime]);

  // Subtitle offset adjustment with keyboard
  const adjustSubtitleOffset = useCallback((delta) => {
    setSubtitleOffset(prev => prev + delta);
    if (subtitleOffsetTimerRef.current) return;
    subtitleOffsetToastRef.current = toast.info(`Subtitle offset: ${subtitleOffsetRef.current + delta}ms`);
    subtitleOffsetTimerRef.current = setTimeout(() => {
      subtitleOffsetTimerRef.current = null;
    }, 300);
  }, []);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        skip(-10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        skip(10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleVolumeChange([Math.min(1, volumeRef.current + 0.1)]);
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleVolumeChange([Math.max(0, volumeRef.current - 0.1)]);
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
      case 's':
        e.preventDefault();
        setShowSubtitleMenu(prev => !prev);
        break;
      case 'c':
        e.preventDefault();
        setSubtitlesEnabled(prev => !prev);
        break;
      case 'g':
        e.preventDefault();
        adjustSubtitleOffset(-100);
        break;
      case 'h':
        e.preventDefault();
        adjustSubtitleOffset(100);
        break;
      case 'Escape':
        if (showSubtitleMenuRef.current) {
          setShowSubtitleMenu(false);
        } else if (showSettingsRef.current) {
          setShowSettings(false);
        } else if (fullscreenRef.current) {
          document.exitFullscreen();
        }
        break;
      default:
        break;
    }
  }, [togglePlay, skip, handleVolumeChange, toggleFullscreen, toggleMute, adjustSubtitleOffset]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !media) {
    return <PlaybackErrorScreen message={error} onBack={() => goBack(navigate, location)} />;
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black relative"
      onMouseMove={handleMouseMove}
      onClick={() => {
        if (!showSubtitleMenu && !showSettings) {
          togglePlay();
        }
      }}
      data-testid="video-player"
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={streamUrl || undefined}
        className="w-full h-full absolute inset-0 object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={handleError}
        onClick={(e) => e.stopPropagation()}
        crossOrigin="anonymous"
        playsInline
        data-playback-mode={isTranscoding ? (playback?.mode && playback.mode !== 'direct' ? playback.mode : 'transcode') : 'direct'}
      >
        {/* Subtitle track (re-mounted when re-timed) */}
        {currentSubtitle && subtitlesEnabled && subtitleTrackUrl && (
          <track
            key={subtitleTrackUrl}
            ref={trackRef}
            kind="subtitles"
            src={subtitleTrackUrl}
            srcLang={currentSubtitle.language_code || 'en'}
            label={currentSubtitle.language}
            default
          />
        )}
      </video>

      {/* Custom subtitle display (for better styling) */}
      {currentSubtitle && subtitlesEnabled && (
        <div 
          className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none px-8"
          style={{ fontSize: `${subtitleSize}%` }}
        >
          {/* Subtitles rendered via track element */}
        </div>
      )}

      {/* Buffering indicator */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <RefreshCw className="w-12 h-12 animate-spin text-white" />
        </div>
      )}

      {/* Skip Intro/Credits Button */}
      <AnimatePresence>
        {showSkipButton && currentSkipSegment && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute bottom-32 right-8 pointer-events-auto z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={handleSkipSegment}
              className="bg-white/90 text-black hover:bg-white px-6 py-3 text-base font-semibold shadow-2xl"
              data-testid="skip-segment-btn"
            >
              <FastForward className="w-5 h-5 mr-2" />
              Skip {currentSkipSegment.type === SKIP_TYPES.INTRO ? 'Intro' : 
                    currentSkipSegment.type === SKIP_TYPES.CREDITS ? 'Credits' :
                    currentSkipSegment.type === SKIP_TYPES.RECAP ? 'Recap' : 'Preview'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Episode Prompt */}
      <AnimatePresence>
        {showNextEpisode && nextEpisode && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-32 left-8 right-8 md:left-auto md:right-8 md:w-96 pointer-events-auto z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Up Next</span>
                  {nextEpisodeCountdown !== null && (
                    <span className="text-xs text-violet-400">
                      Playing in {nextEpisodeCountdown}s
                    </span>
                  )}
                </div>
                
                <div className="flex gap-3">
                  {nextEpisode.thumbnail && (
                    <img 
                      src={nextEpisode.thumbnail} 
                      alt={nextEpisode.title}
                      className="w-24 h-14 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{nextEpisode.title}</h4>
                    {nextEpisode.series_name && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        S{nextEpisode.season_number?.toString().padStart(2, '0')}E{nextEpisode.episode_number?.toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={playNextEpisode}
                    className="flex-1 bg-violet-600 hover:bg-violet-700"
                    data-testid="play-next-btn"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Play Now
                  </Button>
                  <Button
                    onClick={cancelNextEpisode}
                    variant="outline"
                    className="border-white/20"
                    data-testid="cancel-next-btn"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Progress bar for auto-play */}
              {nextEpisodeCountdown !== null && (
                <div className="h-1 bg-white/10">
                  <motion.div
                    className="h-full bg-violet-500"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: nextEpisodeCountdown, ease: 'linear' }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"
      />

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : -20 }}
        className="absolute top-0 left-0 right-0 p-4 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/20"
            data-testid="video-back-btn"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{media.title}</h1>
            {media.series_name && (
              <p className="text-sm text-gray-300">
                {media.series_name} - S{media.season_number?.toString().padStart(2, '0')}E{media.episode_number?.toString().padStart(2, '0')}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Bottom controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
        className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="mb-4">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            onValueCommit={handleSeekCommit}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-white/20"
              data-testid="play-pause-btn"
            >
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>

            {/* Skip buttons */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(-10)}
              className="text-white hover:bg-white/20"
              data-testid="skip-back-btn"
            >
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(10)}
              className="text-white hover:bg-white/20"
              data-testid="skip-forward-btn"
            >
              <SkipForward className="w-5 h-5" />
            </Button>

            {/* Volume */}
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
                data-testid="mute-btn"
              >
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <div className="w-24">
                <Slider
                  value={[muted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Subtitle indicator */}
            {currentSubtitle && subtitlesEnabled && (
              <span className="text-xs text-green-400 mr-2">
                {currentSubtitle.language}
              </span>
            )}

            {/* Media info */}
            <span className="text-xs text-gray-400 mr-4">
              {formatResolution(media.width, media.height)}
              {media.codec_video && ` • ${media.codec_video.toUpperCase()}`}
            </span>

            {/* Subtitles button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
              className={`text-white hover:bg-white/20 ${subtitlesEnabled ? 'text-green-400' : ''}`}
              data-testid="subtitles-btn"
            >
              <Subtitles className="w-5 h-5" />
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white hover:bg-white/20"
              data-testid="settings-btn"
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
              data-testid="fullscreen-btn"
            >
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Subtitle Menu Overlay */}
      <AnimatePresence>
        {showSubtitleMenu && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 bottom-24 w-80 max-h-96 overflow-y-auto rounded-xl bg-black/90 backdrop-blur-lg border border-white/10 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="subtitle-menu"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Subtitles className="w-5 h-5 text-green-400" />
                  Subtitles (Garnish 🌿)
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSubtitleMenu(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-2">
              {/* Off option */}
              <button
                onClick={() => {
                  setSubtitlesEnabled(false);
                  setCurrentSubtitle(null);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 ${
                  !subtitlesEnabled ? 'bg-white/10' : ''
                }`}
              >
                <span>Off</span>
                {!subtitlesEnabled && <Check className="w-4 h-4 text-green-400" />}
              </button>

              {/* Available subtitles */}
              {searchingSubtitles ? (
                <div className="p-4 text-center text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Searching for subtitles...
                </div>
              ) : availableSubtitles.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 px-3 py-2">Available ({availableSubtitles.length})</p>
                  {availableSubtitles.map((sub, idx) => (
                    <button
                      key={sub.id || sub.download_url || idx}
                      onClick={() => loadSubtitle(sub)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 ${
                        currentSubtitle?.download_url === sub.download_url && subtitlesEnabled ? 'bg-white/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Languages className="w-4 h-4 text-gray-400" />
                        <div className="text-left">
                          <p className="text-sm">{sub.language}</p>
                          <p className="text-xs text-gray-500">{sub.source}</p>
                        </div>
                      </div>
                      {currentSubtitle?.download_url === sub.download_url && subtitlesEnabled ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Download className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-400">
                  <Subtitles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No subtitles found</p>
                  <p className="text-xs mt-1">Try adding sources in Settings → Subtitles</p>
                </div>
              )}
            </div>

            {/* Subtitle offset controls */}
            {subtitlesEnabled && currentSubtitle && (
              <div className="p-4 border-t border-white/10">
                <p className="text-xs text-gray-500 mb-2">Sync adjustment</p>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustSubtitleOffset(-100)}
                    className="text-xs"
                  >
                    -100ms (G)
                  </Button>
                  <span className="text-sm">{subtitleOffset}ms</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustSubtitleOffset(100)}
                    className="text-xs"
                  >
                    +100ms (H)
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Menu Overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 bottom-24 w-80 max-h-96 overflow-y-auto rounded-xl bg-black/90 backdrop-blur-lg border border-white/10 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Settings
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Subtitle size */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Subtitle Size</label>
                <Slider
                  value={[subtitleSize]}
                  min={50}
                  max={200}
                  step={10}
                  onValueChange={(v) => setSubtitleSize(v[0])}
                />
                <p className="text-xs text-gray-500 mt-1">{subtitleSize}%</p>
              </div>

              {/* Playback speed */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Playback Speed</label>
                <div className="flex gap-2 flex-wrap">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => {
                        if (videoRef.current) videoRef.current.playbackRate = speed;
                      }}
                      className={`px-3 py-1 rounded text-sm ${
                        videoRef.current?.playbackRate === speed 
                          ? 'bg-violet-500/20 text-violet-400' 
                          : 'bg-white/5 text-gray-400'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-play next episode (TV shows only) */}
              {(media?.type === 'tv' || media?.series_name) && (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm text-gray-400">Auto-play Next Episode</label>
                    <p className="text-xs text-gray-500">Automatically play next episode when current one ends</p>
                  </div>
                  <button
                    onClick={() => setAutoPlayNext(!autoPlayNext)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      autoPlayNext ? 'bg-violet-600' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      autoPlayNext ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              )}

              {/* Keyboard shortcuts */}
              <div>
                <p className="text-sm text-gray-400 mb-2">Keyboard Shortcuts</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd> Play/Pause</p>
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">←/→</kbd> Seek ±10s</p>
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑/↓</kbd> Volume</p>
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">S</kbd> Subtitles</p>
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">C</kbd> Toggle subs</p>
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">G/H</kbd> Subtitle sync</p>
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">F</kbd> Fullscreen</p>
                  <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">M</kbd> Mute</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center play button (shown when paused) */}
      {!playing && !buffering && !showSubtitleMenu && !showSettings && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center"
          >
            <Play className="w-10 h-10 text-white ml-1" />
          </motion.div>
        </div>
      )}
    </div>
  );
};

// navigate(-1) does nothing useful when the player was opened directly (deep
// link / new tab; React Router marks that first entry with key 'default') —
// fall back to the dashboard in that case.
function goBack(navigate, location) {
  if (location && location.key && location.key !== 'default') {
    navigate(-1);
  } else {
    navigate('/', { replace: true });
  }
}

// Local boundary: any unexpected render error inside the player is shown as
// the player's own "Playback Error" screen (with a back button) rather than
// bubbling up to the generic route-level crash screen.
class PlayerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[VideoPlayer] render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <PlaybackErrorScreen
          message="Something went wrong while starting playback"
          onBack={this.props.onBack}
        />
      );
    }
    return this.props.children;
  }
}

const VideoPlayer = () => {
  const { mediaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <PlayerErrorBoundary key={mediaId} onBack={() => goBack(navigate, location)}>
      <PlayerInner />
    </PlayerErrorBoundary>
  );
};

export default VideoPlayer;
