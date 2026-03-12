import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Info, Star, Calendar, Clock } from 'lucide-react';
import { getTitle, getReleaseYear, getMediaType, formatDuration } from '../../lib/utils';

export const HeroBanner = ({ items = [], autoRotate = true }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentItem = items[currentIndex];

  useEffect(() => {
    if (!autoRotate || items.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [items.length, autoRotate]);

  if (!currentItem) return null;

  const title = getTitle(currentItem);
  const year = getReleaseYear(currentItem);
  const mediaType = getMediaType(currentItem);
  const backdropUrl = currentItem.backdrop_url || (currentItem.backdrop_path ? `https://image.tmdb.org/t/p/w1280${currentItem.backdrop_path}` : null);

  return (
    <div data-testid="hero-banner" className="relative h-[70vh] min-h-[500px] w-full overflow-hidden">
      {/* Background Image with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-900/30 to-pink-900/30" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            {/* Type Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/80 backdrop-blur-sm mb-4"
            >
              <span className="text-xs font-semibold uppercase tracking-wider">
                {mediaType === 'tv' ? 'TV Series' : 'Movie'}
              </span>
            </motion.div>

            {/* Title */}
            <h1 className="text-4xl lg:text-6xl font-extrabold mb-4 tracking-tight">
              {title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-300">
              {currentItem.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{currentItem.vote_average.toFixed(1)}</span>
                </span>
              )}
              {year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {year}
                </span>
              )}
              {currentItem.runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(currentItem.runtime)}
                </span>
              )}
              {currentItem.genres && currentItem.genres.length > 0 && (
                <span className="hidden md:inline">
                  {currentItem.genres.slice(0, 3).map(g => g.name || g).join(' • ')}
                </span>
              )}
            </div>

            {/* Overview */}
            <p className="text-gray-300 text-base lg:text-lg line-clamp-3 mb-6 max-w-xl">
              {currentItem.overview}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/${mediaType}/${currentItem.id}`}
                data-testid="hero-play-btn"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold transition-all btn-glow"
              >
                <Play className="w-5 h-5 fill-white" />
                Play Now
              </Link>
              <Link
                to={`/${mediaType}/${currentItem.id}`}
                data-testid="hero-info-btn"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-medium transition-colors border border-white/10"
              >
                <Info className="w-5 h-5" />
                More Info
              </Link>
              <button
                data-testid="hero-add-btn"
                className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors border border-white/10"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination Dots */}
        {items.length > 1 && (
          <div className="absolute bottom-8 right-8 flex gap-2">
            {items.slice(0, 5).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                data-testid={`hero-dot-${index}`}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 bg-violet-500'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
