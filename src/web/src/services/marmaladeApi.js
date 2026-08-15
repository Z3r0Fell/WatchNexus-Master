import axios from 'axios';

// Use REACT_APP_BACKEND_URL if set, otherwise use empty string for same-origin requests
const API = process.env.REACT_APP_BACKEND_URL || '';

// Create axios instance for Marmalade
const marmaladeClient = axios.create({
  baseURL: `${API}/api/marmalade`,
  timeout: 30000,
  withCredentials: true,
});

// Response interceptor for centralized error handling
marmaladeClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timed out. Please try again.'));
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }
    return Promise.reject(error);
  }
);

// Marmalade Server Status
export const marmaladeStatus = {
  getStatus: () => marmaladeClient.get('/status'),
};

// Library Management
export const marmaladeLibrary = {
  // Get all libraries
  getLibraries: () => marmaladeClient.get('/libraries'),
  
  // Add a new library
  addLibrary: (name, path, mediaType = 'movies') =>
    marmaladeClient.post('/libraries', { name, path, media_type: mediaType }),
  
  // Remove a library
  removeLibrary: (libraryId) =>
    marmaladeClient.delete(`/libraries/${libraryId}`),
  
  // Scan a library
  scanLibrary: (libraryId) =>
    marmaladeClient.post(`/libraries/${libraryId}/scan`),
    
  // Refresh metadata for all media in a library
  refreshMetadata: (libraryId) =>
    marmaladeClient.post(`/libraries/${libraryId}/refresh-metadata`),
};

// Media Retrieval
export const marmaladeMedia = {
  // Get media list with optional filtering
  getMedia: (params = {}) =>
    marmaladeClient.get('/media', { params }),
  
  // Get a specific media item
  getMediaItem: (mediaId) =>
    marmaladeClient.get(`/media/${mediaId}`),
  
  // Get recently added media
  getRecent: (limit = 20) =>
    marmaladeClient.get('/media/recent', { params: { limit } }),
  
  // Search media
  search: (query, limit = 50) =>
    marmaladeClient.get('/media/search', { params: { query, limit: Math.min(limit, 200) } }),
  
  // Get continue watching list
  getContinueWatching: (limit = 10) =>
    marmaladeClient.get('/continue-watching', { params: { limit } }),
    
  // Get TV series grouped by show and season
  getTVSeriesGrouped: (libraryId = null) =>
    marmaladeClient.get('/tv-series', { params: libraryId ? { library_id: libraryId } : {} }),
};

// Watch Progress
export const marmaladeProgress = {
  // Update watch progress
  updateProgress: (mediaId, progress) =>
    marmaladeClient.post(`/media/${mediaId}/progress`, { progress }),
  
  // Mark as watched/unwatched
  markWatched: (mediaId, watched = true) =>
    marmaladeClient.post(`/media/${mediaId}/watched`, { watched }),
};

// Streaming
export const marmaladeStream = {
  // Get stream info for a media file
  getStreamInfo: (mediaId, quality = 'original') =>
    marmaladeClient.get(`/stream/${mediaId}`, { params: { quality } }),
  
  // Get an authorised, signed stream URL for the video player. The HTML5
  // <video> element can't send our bearer token, so we mint a short-lived
  // signed stream token via an authenticated request first.
  getStreamUrl: async (mediaId) => {
    const res = await marmaladeClient.get(`/stream/${mediaId}/authorize`);
    const streamUrl = res.data?.stream_url;
    if (!streamUrl) {
      throw new Error('No stream URL returned from server');
    }
    // If the server returns an absolute URL, use it directly.
    // Otherwise, resolve it against the API base URL.
    if (streamUrl.startsWith('http://') || streamUrl.startsWith('https://')) {
      return streamUrl;
    }
    return `${API}${streamUrl}`;
  },
};

// Helper functions
export const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatResolution = (width, height) => {
  if (!width || !height) return '';
  
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  return `${height}p`;
};

export default marmaladeClient;
