import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { MediaCard } from './MediaCard';
import { cn } from '../../lib/utils';

export const MediaRow = ({ 
  title, 
  items = [], 
  onAddToWatchlist,
  watchlist = [],
  loading = false 
}) => {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const isInWatchlist = (itemId) => {
    return watchlist.some(w => w.tmdb_id === itemId);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group/row py-4"
    >
      {/* Title */}
      <h2 className="text-xl font-bold px-8 mb-4">{title}</h2>
      
      {/* Scroll Container */}
      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-full",
            "bg-gradient-to-r from-[#0A0A0A] to-transparent",
            "flex items-center justify-start pl-2",
            "opacity-0 group-hover/row:opacity-100 transition-opacity",
            !showLeftArrow && "pointer-events-none"
          )}
        >
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </div>
        </button>

        {/* Items */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto px-8 pb-4 hide-scrollbar scroll-smooth"
        >
          {loading ? (
            // Skeleton loading
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[160px]">
                <div className="aspect-[2/3] skeleton rounded-xl" />
              </div>
            ))
          ) : (
            items.map((item, index) => (
              <div key={item.id} className="flex-shrink-0 w-[160px]">
                <MediaCard
                  item={item}
                  index={index}
                  onAddToWatchlist={onAddToWatchlist}
                  isInWatchlist={isInWatchlist(item.id)}
                />
              </div>
            ))
          )}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-full",
            "bg-gradient-to-l from-[#0A0A0A] to-transparent",
            "flex items-center justify-end pr-2",
            "opacity-0 group-hover/row:opacity-100 transition-opacity",
            !showRightArrow && "pointer-events-none"
          )}
        >
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>
    </motion.section>
  );
};
