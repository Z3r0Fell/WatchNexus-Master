import axios from 'axios';

// Use REACT_APP_BACKEND_URL if set, otherwise use empty string for same-origin requests
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Centralized axios instance for authenticated API calls
const apiClient = axios.create({
  baseURL: API,
  withCredentials: true,
  timeout: 30000,
});

// Request interceptor for consistent headers
apiClient.interceptors.request.use((config) => {
  return config;
});

// Response interceptor for centralized error handling
apiClient.interceptors.response.use(
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

// TMDB API calls (public, no auth required)
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
  get: () => apiClient.get(`/watchlist`),
  add: (item) => apiClient.post(`/watchlist`, item),
  remove: (tmdbId) => apiClient.delete(`/watchlist/${tmdbId}`),
};

// Watch progress API calls
export const progressApi = {
  get: () => apiClient.get(`/watch-progress`),
  update: (progress) => apiClient.post(`/watch-progress`, progress),
  getNextUp: () => apiClient.get(`/next-up`),
  delete: (tmdbId, mediaType, season = null, episode = null) => {
    const params = { tmdb_id: tmdbId, media_type: mediaType };
    if (season) params.season = season;
    if (episode) params.episode = episode;
    return apiClient.delete(`/watch-progress`, { params });
  },
  clearAll: () => apiClient.delete(`/watch-progress/all`),
};

// Downloads API calls
export const downloadsApi = {
  getAll: () => apiClient.get(`/downloads`),
  add: (title, mediaType, tmdbId, size) =>
    apiClient.post(`/downloads`, { title, media_type: mediaType, tmdb_id: tmdbId, size }),
  update: (downloadId, status, progress) =>
    apiClient.patch(`/downloads/${downloadId}`, { status, progress }),
  delete: (downloadId) => apiClient.delete(`/downloads/${downloadId}`),
};

// Settings API calls
export const settingsApi = {
  get: () => apiClient.get(`/settings`),
  update: (settings) => apiClient.put(`/settings`, settings),
};

// Indexers API calls
export const indexersApi = {
  getAll: () => apiClient.get(`/indexers`),
  add: (indexer) => apiClient.post(`/indexers`, indexer),
  update: (indexerId, indexer) => apiClient.put(`/indexers/${indexerId}`, indexer),
};

// Streaming services API calls
export const streamingApi = {
  getAll: () => apiClient.get(`/streaming-services`),
  update: (serviceId, enabled, username) =>
    apiClient.put(`/streaming-services/${serviceId}`, { enabled, username }),
};

// Library API calls
export const libraryApi = {
  getAll: (mediaType) => apiClient.get(`/library`, { params: { media_type: mediaType } }),
  add: (item) => apiClient.post(`/library`, item),
  getRecentlyAdded: (limit = 20) => apiClient.get(`/marmalade/media/recent`, { params: { limit } }),
};

// Media Health Checker API calls
export const mediaHealthApi = {
  checkFile: (filePath, computeHash = false) =>
    apiClient.post(`/media/health-check`, { file_path: filePath, compute_hash: computeHash }),
  
  repairFile: (filePath, outputPath = null) =>
    apiClient.post(`/media/repair`, { file_path: filePath, output_path: outputPath }),
  
  scanLibrary: (directory) =>
    apiClient.post(`/media/scan-library`, { directory }),
  
  // Scheduled scans
  getScheduledScans: () =>
    apiClient.get(`/media/scheduled-scans`),
  
  createScheduledScan: (scan) =>
    apiClient.post(`/media/scheduled-scans`, scan),
  
  updateScheduledScan: (scanId, scan) =>
    apiClient.put(`/media/scheduled-scans/${scanId}`, scan),
  
  deleteScheduledScan: (scanId) =>
    apiClient.delete(`/media/scheduled-scans/${scanId}`),
  
  runScheduledScanNow: (scanId) =>
    apiClient.post(`/media/scheduled-scans/${scanId}/run`),
  
  // Notifications
  getNotifications: (unreadOnly = false) =>
    apiClient.get(`/media/notifications`, { params: { unread_only: unreadOnly } }),
  
  markNotificationRead: (notificationId) =>
    apiClient.put(`/media/notifications/${notificationId}/read`),
  
  deleteNotification: (notificationId) =>
    apiClient.delete(`/media/notifications/${notificationId}`),
  
  // Re-download
  requestRedownload: (filePath, title, mediaType = 'movie', tmdbId = null) =>
    apiClient.post(`/media/redownload`, { file_path: filePath, title, media_type: mediaType, tmdb_id: tmdbId }),
};

// Auth API calls — local account auth only (Google OAuth removed in v1.0.0 RTP).
export const authApi = {
  logout: () =>
    apiClient.post(`/auth/logout`),

  getMe: () =>
    apiClient.get(`/auth/me`),
};

// Compote - Indexer Manager API calls
export const compoteApi = {
  // Indexers
  getIndexers: () =>
    apiClient.get(`/compote/indexers`),
  
  getIndexerTypes: () =>
    apiClient.get(`/compote/indexer-types`),
  
  getSetupGuide: () =>
    apiClient.get(`/compote/setup-guide`),
  
  getDefaultIndexers: () =>
    apiClient.get(`/compote/default-indexers`),
  
  addIndexer: (name, type, url, apiKey = '', enabled = true, priority = 50, options = {}) =>
    apiClient.post(`/compote/indexers`, {
      name,
      indexer_type: type,
      url,
      api_key: apiKey,
      enabled,
      priority,
      cloudflare_protected: options.cloudflare_protected || false,
      search_path: options.search_path || '',
      cookie: options.cookie || '',
    }),
  
  updateIndexer: (indexerId, updates) =>
    apiClient.put(`/compote/indexers/${indexerId}`, updates),
  
  removeIndexer: (indexerId) =>
    apiClient.delete(`/compote/indexers/${indexerId}`),
  
  testIndexer: (indexerId) =>
    apiClient.post(`/compote/indexers/${indexerId}/test`),
  
  // Search
  search: (query, mediaType = 'movies', sortBy = 'seeders', limit = 50) =>
    apiClient.get(`/compote/search`, { 
      params: { query, media_type: mediaType, sort_by: sortBy, limit: Math.min(limit, 200) } 
    }),
  
  // Grab/Download - uses built-in engine by default
  grab: (title, downloadUrl = null, magnetUrl = null, size = 0, useBuiltin = true) =>
    apiClient.post(`/compote/grab`, null, { 
      params: { title, download_url: downloadUrl, magnet_url: magnetUrl, size, use_builtin: useBuiltin } 
    }),
};

// qBittorrent API calls (legacy - external client)
export const qbittorrentApi = {
  // Status
  getStatus: () =>
    apiClient.get(`/qbittorrent/status`),
  
  // Torrents
  getTorrents: (filter = 'all', category = '', limit = 50) =>
    apiClient.get(`/qbittorrent/torrents`, { params: { filter, category, limit } }),
  
  addTorrent: (url = null, magnet = null, savePath = '', category = 'watchnexus') =>
    apiClient.post(`/qbittorrent/add`, null, { 
      params: { url, magnet, save_path: savePath, category } 
    }),
  
  pauseTorrent: (hash) =>
    apiClient.post(`/qbittorrent/pause/${hash}`),
  
  resumeTorrent: (hash) =>
    apiClient.post(`/qbittorrent/resume/${hash}`),
  
  deleteTorrent: (hash, deleteFiles = false) =>
    apiClient.delete(`/qbittorrent/delete/${hash}`, { params: { delete_files: deleteFiles } }),
  
  getFiles: (hash) =>
    apiClient.get(`/qbittorrent/files/${hash}`),
  
  // Test connection
  testConnection: (host, port, username, password) =>
    apiClient.post(`/qbittorrent/test`, { host, port, username, password }),

  // Config (load + save) — lets users change the default 8080 port
  getConfig: () =>
    apiClient.get(`/qbittorrent/config`),

  saveConfig: (host, port, username, password) =>
    apiClient.put(`/qbittorrent/config`, { host, port, username, password }),
};

// Built-in Torrent Engine API (not available in v1.0.0 — endpoints return 501;
// use qbittorrentApi for real downloads)
export const torrentEngineApi = {
  // Status
  getStatus: () =>
    apiClient.get(`/downloads/engine/status`),
  
  // Torrents
  getTorrents: () =>
    apiClient.get(`/downloads/engine/torrents`),
  
  addTorrent: (magnet, savePath = '', sequential = false, category = 'watchnexus') =>
    apiClient.post(`/downloads/engine/add`, null, { 
      params: { magnet, save_path: savePath, sequential, category } 
    }),
  
  getTorrent: (torrentId) =>
    apiClient.get(`/downloads/engine/${torrentId}`),
  
  getFiles: (torrentId) =>
    apiClient.get(`/downloads/engine/${torrentId}/files`),
  
  pauseTorrent: (torrentId) =>
    apiClient.post(`/downloads/engine/${torrentId}/pause`),
  
  resumeTorrent: (torrentId) =>
    apiClient.post(`/downloads/engine/${torrentId}/resume`),
  
  removeTorrent: (torrentId, deleteFiles = false) =>
    apiClient.delete(`/downloads/engine/${torrentId}`, { params: { delete_files: deleteFiles } }),
  
  setSequential: (torrentId, enabled = true) =>
    apiClient.post(`/downloads/engine/${torrentId}/sequential`, null, { params: { enabled } }),
  
  // Settings
  getSettings: () =>
    apiClient.get(`/downloads/engine/settings`),
  
  updateSettings: (settings) =>
    apiClient.put(`/downloads/engine/settings`, settings),
  
  // Bulk operations
  pauseAll: () =>
    apiClient.post(`/downloads/engine/pause-all`),
  
  resumeAll: () =>
    apiClient.post(`/downloads/engine/resume-all`),
  
  removeCompleted: (deleteFiles = false) =>
    apiClient.post(`/downloads/engine/remove-completed`, null, { params: { delete_files: deleteFiles } }),
};

// Health check
export const healthCheck = () => apiClient.get(`/health`);

// Subtitle API calls
export const subtitleApi = {
  searchTV: (showName, season, episode, languages = 'en') =>
    apiClient.get(`/subtitles/search/tv`, { 
      params: { show_name: showName, season, episode, languages } 
    }),
  
  searchMovie: (movieName, year = null, imdbId = null, languages = 'en') =>
    apiClient.get(`/subtitles/search/movie`, { 
      params: { movie_name: movieName, year, imdb_id: imdbId, languages } 
    }),
  
  download: (downloadUrl, source, mediaId) =>
    apiClient.post(`/subtitles/download`, null, { 
      params: { download_url: downloadUrl, source, media_id: mediaId } 
    }),
  
  getSettings: () => apiClient.get(`/subtitles/settings`),
  
  updateSettings: (settings) => apiClient.put(`/subtitles/settings`, settings),
};

// Gelatin (External Access) API calls
export const gelatinApi = {
  status: () => apiClient.get(`/gelatin/status`),
  
  getLanUrl: () => apiClient.get(`/gelatin/lan-url`),
  
  createTunnel: (provider = 'built_in') =>
    apiClient.post(`/gelatin/tunnel/create`, null, { params: { provider } }),
  
  listTunnels: () => apiClient.get(`/gelatin/tunnels`),
  
  closeTunnel: (tunnelId) => apiClient.delete(`/gelatin/tunnel/${tunnelId}`),
  
  generateAccessToken: (permissions = 'view,watch_party') => {
    const allowed = ['view', 'watch_party', 'admin'];
    const requested = typeof permissions === 'string' ? permissions.split(',').map(p => p.trim()).filter(Boolean) : [permissions];
    const invalid = requested.filter(p => !allowed.includes(p));
    if (invalid.length > 0) {
      return Promise.reject(new Error(`Invalid permissions specified: ${invalid.join(', ')}`));
    }
    return apiClient.post(`/gelatin/access-token`, null, { params: { permissions: requested.join(',') } });
  },
  
  getShareLink: (partyCode, useExternal = false) =>
    apiClient.get(`/gelatin/share-link`, { params: { party_code: partyCode, use_external: useExternal } }),
  
  discoverServers: (timeout = 3.0) =>
    apiClient.get(`/gelatin/discover`, { params: { timeout } }),
};

// Streaming Logins API calls
export const streamingLoginsApi = {
  getServices: () => apiClient.get(`/streaming-logins/services`),
  
  getLogins: () => apiClient.get(`/streaming-logins`),
  
  addLogin: (serviceId, email, password) =>
    apiClient.post(`/streaming-logins`, { service_id: serviceId, email, password }),
  
  deleteLogin: (serviceId) => apiClient.delete(`/streaming-logins/${serviceId}`),
  
  getCredentials: (serviceId) => apiClient.get(`/streaming-logins/${serviceId}/credentials`),
};
