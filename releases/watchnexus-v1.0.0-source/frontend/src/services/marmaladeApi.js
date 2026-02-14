import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Get auth token from localStorage
const getAuthHeader = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Create axios instance for Marmalade
const marmaladeClient = axios.create({
  baseURL: `${API}/api/marmalade`,
});

// Add auth header to all requests
marmaladeClient.interceptors.request.use((config) => {
  config.headers = { ...config.headers, ...getAuthHeader() };
  return config;
});

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
    marmaladeClient.post('/libraries', null, { params: { name, path, media_type: mediaType } }),
  
  // Remove a library
  removeLibrary: (libraryId) =>
    marmaladeClient.delete(`/libraries/${libraryId}`),
  
  // Scan a library
  scanLibrary: (libraryId) =>
    marmaladeClient.post(`/libraries/${libraryId}/scan`),
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
    marmaladeClient.get('/media/search', { params: { query, limit } }),
  
  // Get continue watching list
  getContinueWatching: (limit = 10) =>
    marmaladeClient.get('/continue-watching', { params: { limit } }),
};

// Watch Progress
export const marmaladeProgress = {
  // Update watch progress
  updateProgress: (mediaId, progress) =>
    marmaladeClient.post(`/media/${mediaId}/progress`, null, { params: { progress } }),
  
  // Mark as watched/unwatched
  markWatched: (mediaId, watched = true) =>
    marmaladeClient.post(`/media/${mediaId}/watched`, null, { params: { watched } }),
};

// Streaming
export const marmaladeStream = {
  // Get stream info for a media file
  getStreamInfo: (mediaId, quality = 'original') =>
    marmaladeClient.get(`/stream/${mediaId}`, { params: { quality } }),
  
  // Get the actual stream URL (for the video player)
  getStreamUrl: (mediaId) =>
    `${API}/api/marmalade/stream/${mediaId}/file`,
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
