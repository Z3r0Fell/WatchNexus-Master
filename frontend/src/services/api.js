import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// TMDB API calls
export const tmdbApi = {
  search: (query, page = 1, mediaType = 'multi') =>
    axios.get(`${API}/tmdb/search`, { params: { query, page, media_type: mediaType } }),
  
  getTrending: (mediaType = 'all', timeWindow = 'week') =>
    axios.get(`${API}/tmdb/trending/${mediaType}/${timeWindow}`),
  
  getMovieDetails: (movieId) =>
    axios.get(`${API}/tmdb/movie/${movieId}`),
  
  getTvDetails: (tvId) =>
    axios.get(`${API}/tmdb/tv/${tvId}`),
  
  getTvSeason: (tvId, seasonNum) =>
    axios.get(`${API}/tmdb/tv/${tvId}/season/${seasonNum}`),
  
  discover: (mediaType, params = {}) =>
    axios.get(`${API}/tmdb/discover/${mediaType}`, { params }),
  
  getGenres: (mediaType) =>
    axios.get(`${API}/tmdb/genres/${mediaType}`),
  
  getNowPlaying: (page = 1) =>
    axios.get(`${API}/tmdb/movie/now_playing`, { params: { page } }),
  
  getOnTheAir: (page = 1) =>
    axios.get(`${API}/tmdb/tv/on_the_air`, { params: { page } }),
};

// Watchlist API calls
export const watchlistApi = {
  get: () => axios.get(`${API}/watchlist`),
  add: (item) => axios.post(`${API}/watchlist`, item),
  remove: (tmdbId) => axios.delete(`${API}/watchlist/${tmdbId}`),
};

// Watch progress API calls
export const progressApi = {
  get: () => axios.get(`${API}/watch-progress`),
  update: (progress) => axios.post(`${API}/watch-progress`, progress),
};

// Downloads API calls
export const downloadsApi = {
  getAll: () => axios.get(`${API}/downloads`),
  add: (title, mediaType, tmdbId, size) =>
    axios.post(`${API}/downloads`, null, { params: { title, media_type: mediaType, tmdb_id: tmdbId, size } }),
  update: (downloadId, status, progress) =>
    axios.patch(`${API}/downloads/${downloadId}`, null, { params: { status, progress } }),
  delete: (downloadId) => axios.delete(`${API}/downloads/${downloadId}`),
};

// Settings API calls
export const settingsApi = {
  get: () => axios.get(`${API}/settings`),
  update: (settings) => axios.put(`${API}/settings`, settings),
};

// Indexers API calls
export const indexersApi = {
  getAll: () => axios.get(`${API}/indexers`),
  add: (indexer) => axios.post(`${API}/indexers`, indexer),
  update: (indexerId, indexer) => axios.put(`${API}/indexers/${indexerId}`, indexer),
};

// Streaming services API calls
export const streamingApi = {
  getAll: () => axios.get(`${API}/streaming-services`),
  update: (serviceId, enabled, username) =>
    axios.put(`${API}/streaming-services/${serviceId}`, null, { params: { enabled, username } }),
};

// Library API calls
export const libraryApi = {
  getAll: (mediaType) => axios.get(`${API}/library`, { params: { media_type: mediaType } }),
  add: (item) => axios.post(`${API}/library`, item),
};

// Media Health Checker API calls
export const mediaHealthApi = {
  checkFile: (filePath, computeHash = false) =>
    axios.post(`${API}/media/health-check`, null, { params: { file_path: filePath, compute_hash: computeHash } }),
  
  repairFile: (filePath, outputPath = null) =>
    axios.post(`${API}/media/repair`, null, { params: { file_path: filePath, output_path: outputPath } }),
  
  scanLibrary: (directory) =>
    axios.post(`${API}/media/scan-library`, null, { params: { directory } }),
  
  // Scheduled scans
  getScheduledScans: () =>
    axios.get(`${API}/media/scheduled-scans`),
  
  createScheduledScan: (scan) =>
    axios.post(`${API}/media/scheduled-scans`, scan),
  
  updateScheduledScan: (scanId, scan) =>
    axios.put(`${API}/media/scheduled-scans/${scanId}`, scan),
  
  deleteScheduledScan: (scanId) =>
    axios.delete(`${API}/media/scheduled-scans/${scanId}`),
  
  runScheduledScanNow: (scanId) =>
    axios.post(`${API}/media/scheduled-scans/${scanId}/run`),
  
  // Notifications
  getNotifications: (unreadOnly = false) =>
    axios.get(`${API}/media/notifications`, { params: { unread_only: unreadOnly } }),
  
  markNotificationRead: (notificationId) =>
    axios.put(`${API}/media/notifications/${notificationId}/read`),
  
  deleteNotification: (notificationId) =>
    axios.delete(`${API}/media/notifications/${notificationId}`),
  
  // Re-download
  requestRedownload: (filePath, title, mediaType = 'movie', tmdbId = null) =>
    axios.post(`${API}/media/redownload`, null, { 
      params: { file_path: filePath, title, media_type: mediaType, tmdb_id: tmdbId } 
    }),
};

// Google OAuth API calls
export const authApi = {
  googleSession: (sessionId) =>
    axios.post(`${API}/auth/google/session`, null, { 
      params: { session_id: sessionId },
      withCredentials: true 
    }),
  
  logout: () =>
    axios.post(`${API}/auth/logout`, null, { withCredentials: true }),
  
  getMe: () =>
    axios.get(`${API}/auth/me`, { withCredentials: true }),
};

// Compote - Indexer Manager API calls
export const compoteApi = {
  // Indexers
  getIndexers: () =>
    axios.get(`${API}/compote/indexers`),
  
  addIndexer: (name, type, url, apiKey = '', enabled = true, priority = 50) =>
    axios.post(`${API}/compote/indexers`, null, { 
      params: { name, indexer_type: type, url, api_key: apiKey, enabled, priority } 
    }),
  
  removeIndexer: (indexerId) =>
    axios.delete(`${API}/compote/indexers/${indexerId}`),
  
  testIndexer: (indexerId) =>
    axios.post(`${API}/compote/indexers/${indexerId}/test`),
  
  // Search
  search: (query, mediaType = 'movies', sortBy = 'seeders', limit = 50) =>
    axios.get(`${API}/compote/search`, { 
      params: { query, media_type: mediaType, sort_by: sortBy, limit } 
    }),
  
  // Grab/Download
  grab: (title, downloadUrl = null, magnetUrl = null, size = 0) =>
    axios.post(`${API}/compote/grab`, null, { 
      params: { title, download_url: downloadUrl, magnet_url: magnetUrl, size } 
    }),
};

// qBittorrent API calls
export const qbittorrentApi = {
  // Status
  getStatus: () =>
    axios.get(`${API}/qbittorrent/status`),
  
  // Torrents
  getTorrents: (filter = 'all', category = '', limit = 50) =>
    axios.get(`${API}/qbittorrent/torrents`, { params: { filter, category, limit } }),
  
  addTorrent: (url = null, magnet = null, savePath = '', category = 'watchnexus') =>
    axios.post(`${API}/qbittorrent/add`, null, { 
      params: { url, magnet, save_path: savePath, category } 
    }),
  
  pauseTorrent: (hash) =>
    axios.post(`${API}/qbittorrent/pause/${hash}`),
  
  resumeTorrent: (hash) =>
    axios.post(`${API}/qbittorrent/resume/${hash}`),
  
  deleteTorrent: (hash, deleteFiles = false) =>
    axios.delete(`${API}/qbittorrent/delete/${hash}`, { params: { delete_files: deleteFiles } }),
  
  getFiles: (hash) =>
    axios.get(`${API}/qbittorrent/files/${hash}`),
  
  // Test connection
  testConnection: (host, port, username, password) =>
    axios.post(`${API}/qbittorrent/test`, null, { 
      params: { host, port, username, password } 
    }),
};

// Health check
export const healthCheck = () => axios.get(`${API}/health`);
