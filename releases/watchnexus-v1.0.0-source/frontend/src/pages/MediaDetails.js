import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { tmdbApi, watchlistApi, downloadsApi, progressApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Play, Plus, Check, Download, Star, Calendar, Clock, 
  ChevronDown, ExternalLink, ArrowLeft, Users
} from 'lucide-react';
import { formatDuration, getTitle } from '../lib/utils';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export const MediaDetails = () => {
  const { type, id } = useParams();
  const [media, setMedia] = useState(null);
  const [season, setSeason] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    fetchMediaDetails();
    checkWatchlist();
  }, [type, id]);

  useEffect(() => {
    if (type === 'tv' && media) {
      fetchSeason();
    }
  }, [selectedSeason, media]);

  const fetchMediaDetails = async () => {
    setLoading(true);
    try {
      const response = type === 'movie'
        ? await tmdbApi.getMovieDetails(id)
        : await tmdbApi.getTvDetails(id);
      setMedia(response.data);
    } catch (error) {
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeason = async () => {
    if (type !== 'tv') return;
    try {
      const response = await tmdbApi.getTvSeason(id, selectedSeason);
      setSeason(response.data);
    } catch (error) {
      console.error('Failed to fetch season:', error);
    }
  };

  const checkWatchlist = async () => {
    try {
      const response = await watchlistApi.get();
      setIsInWatchlist(response.data.some(w => w.tmdb_id === parseInt(id)));
    } catch (error) {
      console.error('Failed to check watchlist:', error);
    }
  };

  const handleWatchlistToggle = async () => {
    try {
      if (isInWatchlist) {
        await watchlistApi.remove(parseInt(id));
        setIsInWatchlist(false);
        toast.success('Removed from watchlist');
      } else {
        await watchlistApi.add({
          tmdb_id: parseInt(id),
          media_type: type,
          title: getTitle(media),
          poster_path: media.poster_path,
        });
        setIsInWatchlist(true);
        toast.success('Added to watchlist');
      }
    } catch (error) {
      toast.error('Failed to update watchlist');
    }
  };

  const handleDownload = async () => {
    try {
      await downloadsApi.add(getTitle(media), type, parseInt(id), 1500000000);
      toast.success('Added to download queue');
    } catch (error) {
      toast.error('Failed to add to downloads');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!media) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-400">Content not found</p>
        </div>
      </Layout>
    );
  }

  const title = getTitle(media);
  const year = media.release_date?.slice(0, 4) || media.first_air_date?.slice(0, 4);
  const backdropUrl = media.backdrop_url || (media.backdrop_path ? `https://image.tmdb.org/t/p/w1280${media.backdrop_path}` : null);
  const posterUrl = media.poster_url || (media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null);
  const cast = media.credits?.cast?.slice(0, 10) || [];
  const similar = media.similar?.results?.slice(0, 6) || media.recommendations?.results?.slice(0, 6) || [];

  return (
    <Layout>
      <div data-testid="media-details" className="min-h-screen">
        {/* Hero Section */}
        <div className="relative h-[80vh] min-h-[600px]">
          {/* Backdrop */}
          {backdropUrl && (
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={backdropUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 hero-gradient" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />

          {/* Back Button */}
          <Link
            to="/"
            data-testid="back-btn"
            className="absolute top-6 left-6 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
            <div className="flex gap-8 items-end">
              {/* Poster */}
              {posterUrl && (
                <motion.img
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  src={posterUrl}
                  alt={title}
                  className="hidden lg:block w-64 rounded-xl shadow-2xl border border-white/10"
                />
              )}

              {/* Info */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 max-w-2xl"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full bg-violet-600/80 text-xs font-semibold uppercase">
                    {type === 'tv' ? 'TV Series' : 'Movie'}
                  </span>
                  {media.vote_average > 0 && (
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-semibold">
                      <Star className="w-3 h-3 fill-yellow-400" />
                      {media.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>

                <h1 className="text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight">{title}</h1>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-300">
                  {year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {year}
                    </span>
                  )}
                  {media.runtime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(media.runtime)}
                    </span>
                  )}
                  {type === 'tv' && media.number_of_seasons && (
                    <span>{media.number_of_seasons} Season{media.number_of_seasons > 1 ? 's' : ''}</span>
                  )}
                  {media.genres && (
                    <span>{media.genres.map(g => g.name).join(' • ')}</span>
                  )}
                </div>

                {/* Overview */}
                <p className="text-gray-300 text-base lg:text-lg line-clamp-4 mb-6">
                  {media.overview}
                </p>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  {media.trailer_key && (
                    <Button
                      onClick={() => setShowTrailer(true)}
                      data-testid="play-trailer-btn"
                      className="bg-violet-600 hover:bg-violet-700 px-8 py-3 rounded-full font-bold btn-glow"
                    >
                      <Play className="w-5 h-5 fill-white mr-2" />
                      Watch Trailer
                    </Button>
                  )}
                  <Button
                    onClick={handleWatchlistToggle}
                    data-testid="watchlist-btn"
                    variant="outline"
                    className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border-white/10"
                  >
                    {isInWatchlist ? <Check className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                    {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                  </Button>
                  <Button
                    onClick={handleDownload}
                    data-testid="download-btn"
                    variant="outline"
                    className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border-white/10"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Trailer Modal */}
        {showTrailer && media.trailer_key && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setShowTrailer(false)}
          >
            <div className="w-full max-w-5xl aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${media.trailer_key}?autoplay=1`}
                className="w-full h-full rounded-xl"
                allowFullScreen
                allow="autoplay"
              />
            </div>
          </motion.div>
        )}

        {/* TV Show Seasons */}
        {type === 'tv' && media.seasons && (
          <section className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold">Episodes</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-white/5 border-white/10">
                    Season {selectedSeason}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#1E1E1E] border-white/10">
                  {media.seasons
                    .filter(s => s.season_number > 0)
                    .map((s) => (
                      <DropdownMenuItem
                        key={s.season_number}
                        onClick={() => setSelectedSeason(s.season_number)}
                        className={selectedSeason === s.season_number ? 'bg-violet-600/20 text-violet-400' : ''}
                      >
                        Season {s.season_number} ({s.episode_count} episodes)
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Episodes Grid */}
            <div className="grid gap-4">
              {season?.episodes?.map((episode) => (
                <motion.div
                  key={episode.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl overflow-hidden flex gap-4 hover:ring-1 hover:ring-violet-500/50 transition-all cursor-pointer"
                >
                  <div className="w-48 aspect-video flex-shrink-0 relative">
                    {episode.still_url || episode.still_path ? (
                      <img
                        src={episode.still_url || `https://image.tmdb.org/t/p/w300${episode.still_path}`}
                        alt={episode.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center">
                        <span className="text-3xl text-gray-600">{episode.episode_number}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                      <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex-1">
                    <p className="text-sm text-violet-400 mb-1">Episode {episode.episode_number}</p>
                    <h3 className="font-bold mb-2">{episode.name}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{episode.overview}</p>
                    {episode.runtime && (
                      <p className="text-xs text-gray-500 mt-2">{episode.runtime} min</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Cast */}
        {cast.length > 0 && (
          <section className="p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-violet-400" />
              Cast
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {cast.map((person) => (
                <div key={person.id} className="flex-shrink-0 w-32 text-center">
                  <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-2 bg-surface">
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-gray-600">
                        {person.name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-sm line-clamp-1">{person.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{person.character}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Similar */}
        {similar.length > 0 && (
          <section className="p-8">
            <h2 className="text-2xl font-bold mb-6">More Like This</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {similar.map((item) => (
                <Link
                  key={item.id}
                  to={`/${type}/${item.id}`}
                  className="aspect-[2/3] rounded-xl overflow-hidden media-card"
                >
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                      alt={getTitle(item)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface flex items-center justify-center">
                      <span className="text-2xl text-gray-600">{getTitle(item)?.charAt(0)}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="h-12" />
      </div>
    </Layout>
  );
};
