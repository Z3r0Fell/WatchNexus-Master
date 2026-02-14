import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Plus, Star, Check } from 'lucide-react';
import { cn, getTitle, getReleaseYear, getMediaType } from '../../lib/utils';

export const MediaCard = ({ item, onAddToWatchlist, isInWatchlist = false, index = 0 }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const title = getTitle(item);
  const year = getReleaseYear(item);
  const mediaType = getMediaType(item);
  const posterUrl = item.poster_url || item.poster_path;
  const rating = item.vote_average?.toFixed(1);

  return (
    <motion.div
      data-testid={`media-card-${item.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={`/${mediaType}/${item.id}`}
        className="block relative aspect-[2/3] rounded-xl overflow-hidden media-card"
      >
        {/* Skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 skeleton rounded-xl" />
        )}
        
        {/* Poster Image */}
        {posterUrl ? (
          <img
            src={posterUrl.startsWith('http') ? posterUrl : `https://image.tmdb.org/t/p/w342${posterUrl}`}
            alt={title}
            className={cn(
              "w-full h-full object-cover transition-all duration-500",
              imageLoaded ? "opacity-100" : "opacity-0",
              isHovered && "scale-110"
            )}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-surface flex items-center justify-center">
            <span className="text-4xl text-gray-600">{title?.charAt(0)}</span>
          </div>
        )}
        
        {/* Hover Overlay */}
        <motion.div
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end p-4"
        >
          {/* Play Button */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: isHovered ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-14 h-14 rounded-full bg-violet-600 flex items-center justify-center shadow-lg btn-glow">
              <Play className="w-6 h-6 text-white fill-white ml-1" />
            </div>
          </motion.div>
          
          {/* Info */}
          <div>
            <h3 className="font-bold text-white text-sm line-clamp-2">{title}</h3>
            <div className="flex items-center gap-2 mt-1">
              {year && <span className="text-xs text-gray-400">{year}</span>}
              {rating && rating > 0 && (
                <span className="flex items-center gap-1 text-xs text-yellow-400">
                  <Star className="w-3 h-3 fill-yellow-400" />
                  {rating}
                </span>
              )}
            </div>
          </div>
        </motion.div>
        
        {/* Rating Badge (always visible) */}
        {rating && rating > 0 && !isHovered && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-white">{rating}</span>
          </div>
        )}
        
        {/* Media Type Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-violet-600/80 backdrop-blur-sm">
          <span className="text-xs font-medium text-white uppercase">{mediaType}</span>
        </div>
      </Link>
      
      {/* Add to Watchlist Button */}
      {onAddToWatchlist && (
        <button
          data-testid={`add-watchlist-${item.id}`}
          onClick={(e) => {
            e.preventDefault();
            onAddToWatchlist(item);
          }}
          className={cn(
            "absolute bottom-3 right-3 p-2 rounded-full transition-all duration-200 z-10",
            isInWatchlist
              ? "bg-violet-600 text-white"
              : "bg-black/60 backdrop-blur-sm text-white hover:bg-violet-600"
          )}
        >
          {isInWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      )}
    </motion.div>
  );
};
