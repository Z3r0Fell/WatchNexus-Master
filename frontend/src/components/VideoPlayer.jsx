import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, Subtitles, Loader2,
  ChevronLeft, X
} from 'lucide-react';
import { Slider } from '../components/ui/slider';

export const VideoPlayer = ({
  src,
  poster,
  title,
  subtitle,
  onClose,
  onProgress,
  startTime = 0,
  subtitleTracks = [],
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  const [error, setError] = useState(null);

  // Format time to MM:SS or HH:MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Handle seeking
  const handleSeek = useCallback((value) => {
    if (videoRef.current) {
      const newTime = (value[0] / 100) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  // Handle volume change
  const handleVolumeChange = useCallback((value) => {
    if (videoRef.current) {
      const newVolume = value[0] / 100;
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Skip forward/backward
  const skip = useCallback((seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  }, [duration]);

  // Change playback rate
  const changePlaybackRate = useCallback((rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  // Show controls on mouse move
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
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
          handleVolumeChange([Math.min(100, volume * 100 + 10)]);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange([Math.max(0, volume * 100 - 10)]);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (isFullscreen) {
            toggleFullscreen();
          } else if (onClose) {
            onClose();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, handleVolumeChange, toggleFullscreen, toggleMute, isFullscreen, onClose, volume]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      if (startTime > 0) {
        video.currentTime = startTime;
      }
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onProgress) {
        onProgress(video.currentTime, video.duration);
      }
    };

    const onProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };

    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };
    const onError = () => {
      setError('Failed to load video. The format may not be supported.');
      setIsLoading(false);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [startTime, onProgress]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="video-player"
      className={`relative bg-black ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full aspect-video rounded-xl overflow-hidden'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        playsInline
      >
        {subtitleTracks.map((track, index) => (
          <track
            key={index}
            kind="subtitles"
            src={track.src}
            srcLang={track.lang}
            label={track.label}
            default={index === selectedSubtitle}
          />
        ))}
      </video>

      {/* Loading Spinner */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/50"
          >
            <Loader2 className="w-16 h-16 text-violet-500 animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-white text-lg">{error}</p>
          </div>
        </div>
      )}

      {/* Play/Pause Center Button */}
      <AnimatePresence>
        {!isPlaying && !isLoading && !error && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-20 h-20 rounded-full bg-violet-600/80 flex items-center justify-center hover:bg-violet-600 transition-colors">
              <Play className="w-10 h-10 text-white ml-1" fill="white" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/40"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}
                <div>
                  <h2 className="text-white font-bold text-lg">{title}</h2>
                  {subtitle && <p className="text-gray-300 text-sm">{subtitle}</p>}
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="p-4 space-y-3">
              {/* Progress Bar */}
              <div className="relative group">
                {/* Buffered indicator */}
                <div 
                  className="absolute h-1 bg-white/30 rounded-full"
                  style={{ width: `${buffered}%` }}
                />
                <Slider
                  value={[(currentTime / duration) * 100 || 0]}
                  onValueChange={handleSeek}
                  max={100}
                  step={0.1}
                  className="cursor-pointer"
                />
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  <button
                    onClick={togglePlay}
                    data-testid="play-pause-btn"
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white" />
                    )}
                  </button>

                  {/* Skip Backward */}
                  <button
                    onClick={() => skip(-10)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <SkipBack className="w-5 h-5 text-white" />
                  </button>

                  {/* Skip Forward */}
                  <button
                    onClick={() => skip(10)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <SkipForward className="w-5 h-5 text-white" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/volume">
                    <button
                      onClick={toggleMute}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-200">
                      <Slider
                        value={[isMuted ? 0 : volume * 100]}
                        onValueChange={handleVolumeChange}
                        max={100}
                        step={1}
                        className="w-24"
                      />
                    </div>
                  </div>

                  {/* Time */}
                  <span className="text-white text-sm ml-2">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Subtitles */}
                  {subtitleTracks.length > 0 && (
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className={`p-2 rounded-full hover:bg-white/10 transition-colors ${selectedSubtitle >= 0 ? 'text-violet-400' : 'text-white'}`}
                    >
                      <Subtitles className="w-5 h-5" />
                    </button>
                  )}

                  {/* Settings */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <Settings className="w-5 h-5 text-white" />
                    </button>

                    {/* Settings Menu */}
                    <AnimatePresence>
                      {showSettings && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg p-3 min-w-[150px]"
                        >
                          <p className="text-gray-400 text-xs mb-2">Playback Speed</p>
                          <div className="flex flex-wrap gap-1">
                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                              <button
                                key={rate}
                                onClick={() => changePlaybackRate(rate)}
                                className={`px-2 py-1 rounded text-sm ${
                                  playbackRate === rate
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5 text-white" />
                    ) : (
                      <Maximize className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoPlayer;
