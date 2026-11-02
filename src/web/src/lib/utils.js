import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getMediaType = (item) => {
  return item.media_type || (item.title ? 'movie' : 'tv');
};

export const getTitle = (item) => {
  return item.title || item.name;
};

export const getReleaseYear = (item) => {
  const date = item.release_date || item.first_air_date;
  return date ? new Date(date).getFullYear() : null;
};

// Where clicking a locally scanned media item should go.
// Items matched to TMDB open the details page for the matching TMDB type
// (library scans search TMDB "tv" only for tv libraries; every other library
// type, anime included, is matched against TMDB movies). Unmatched items have
// no details page, so they open the player instead of a dead '#' link.
// Libraries (and the items scanned into them) store plural / library-style
// media types ("movies", "tv", "audiobooks"); older code and some endpoints
// use singular ones ("movie", "episode", "audiobook"). Normalize to one
// canonical singular value so comparisons tolerate both spellings.
const MEDIA_TYPE_CANONICAL = {
  movie: 'movie', movies: 'movie',
  tv: 'tv', episode: 'tv', episodes: 'tv', tv_shows: 'tv', tvshow: 'tv', 'tv shows': 'tv', show: 'tv', shows: 'tv',
  anime: 'anime',
  music: 'music', song: 'music', track: 'music',
  audiobook: 'audiobook', audiobooks: 'audiobook',
};
export const normalizeMediaType = (type) => {
  if (!type) return '';
  const key = String(type).trim().toLowerCase();
  return MEDIA_TYPE_CANONICAL[key] || key;
};
export const isMediaType = (type, canonical) => normalizeMediaType(type) === normalizeMediaType(canonical);

export const localMediaHref = (item) => {
  if (!item) return '#';
  if (item.tmdb_id) {
    const isTv = normalizeMediaType(item.media_type) === 'tv';
    return `/${isTv ? 'tv' : 'movie'}/${item.tmdb_id}`;
  }
  return item.id ? `/watch/${item.id}` : '#';
};

// Fetch the items of each given library (by library_id, so results never
// depend on the stored media_type spelling) and tag each item with its
// library id so pages can filter by the selected library card.
export const fetchLibraryItems = async (getMedia, libraries, limit = 500) => {
  const results = await Promise.all(
    (libraries || []).map((lib) =>
      getMedia({ library_id: lib.id, limit })
        .then((res) => (res?.data || []).map((item) => ({ ...item, library_id: item.library_id || lib.id })))
        .catch(() => [])
    )
  );
  return results.flat();
};
