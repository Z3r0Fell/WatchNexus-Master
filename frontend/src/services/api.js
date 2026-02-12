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
  getNextUp: () => axios.get(`${API}/next-up`),
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
  getRecentlyAdded: (limit = 20) => axios.get(`${API}/marmalade/media/recent`, { params: { limit } }),
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
  
  getIndexerTypes: () =>
    axios.get(`${API}/compote/indexer-types`),
  
  getSetupGuide: () =>
    axios.get(`${API}/compote/setup-guide`),
  
  getDefaultIndexers: () =>
    axios.get(`${API}/compote/default-indexers`),
  
  addIndexer: (name, type, url, apiKey = '', enabled = true, priority = 50, options = {}) =>
    axios.post(`${API}/compote/indexers`, null, { 
      params: { 
        name, 
        indexer_type: type, 
        url, 
        api_key: apiKey, 
        enabled, 
        priority,
        cloudflare_protected: options.cloudflare_protected || false,
        search_path: options.search_path || '',
        cookie: options.cookie || '',
      } 
    }),
  
  updateIndexer: (indexerId, updates) =>
    axios.put(`${API}/compote/indexers/${indexerId}`, updates),
  
  removeIndexer: (indexerId) =>
    axios.delete(`${API}/compote/indexers/${indexerId}`),
  
  testIndexer: (indexerId) =>
    axios.post(`${API}/compote/indexers/${indexerId}/test`),
  
  // Search
  search: (query, mediaType = 'movies', sortBy = 'seeders', limit = 50) =>
    axios.get(`${API}/compote/search`, { 
      params: { query, media_type: mediaType, sort_by: sortBy, limit } 
    }),
  
  // Grab/Download - uses built-in engine by default
  grab: (title, downloadUrl = null, magnetUrl = null, size = 0, useBuiltin = true) =>
    axios.post(`${API}/compote/grab`, null, { 
      params: { title, download_url: downloadUrl, magnet_url: magnetUrl, size, use_builtin: useBuiltin } 
    }),
};

// qBittorrent API calls (legacy - external client)
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

// Built-in Torrent Engine API calls (no external apps required!)
export const torrentEngineApi = {
  // Status
  getStatus: () =>
    axios.get(`${API}/downloads/engine/status`),
  
  // Torrents
  getTorrents: () =>
    axios.get(`${API}/downloads/engine/torrents`),
  
  addTorrent: (magnet, savePath = '', sequential = false, category = 'watchnexus') =>
    axios.post(`${API}/downloads/engine/add`, null, { 
      params: { magnet, save_path: savePath, sequential, category } 
    }),
  
  getTorrent: (torrentId) =>
    axios.get(`${API}/downloads/engine/${torrentId}`),
  
  getFiles: (torrentId) =>
    axios.get(`${API}/downloads/engine/${torrentId}/files`),
  
  pauseTorrent: (torrentId) =>
    axios.post(`${API}/downloads/engine/${torrentId}/pause`),
  
  resumeTorrent: (torrentId) =>
    axios.post(`${API}/downloads/engine/${torrentId}/resume`),
  
  removeTorrent: (torrentId, deleteFiles = false) =>
    axios.delete(`${API}/downloads/engine/${torrentId}`, { params: { delete_files: deleteFiles } }),
  
  setSequential: (torrentId, enabled = true) =>
    axios.post(`${API}/downloads/engine/${torrentId}/sequential`, null, { params: { enabled } }),
  
  // Settings
  getSettings: () =>
    axios.get(`${API}/downloads/engine/settings`),
  
  updateSettings: (settings) =>
    axios.put(`${API}/downloads/engine/settings`, settings),
  
  // Bulk operations
  pauseAll: () =>
    axios.post(`${API}/downloads/engine/pause-all`),
  
  resumeAll: () =>
    axios.post(`${API}/downloads/engine/resume-all`),
  
  removeCompleted: (deleteFiles = false) =>
    axios.post(`${API}/downloads/engine/remove-completed`, null, { params: { delete_files: deleteFiles } }),
};

// Health check
export const healthCheck = () => axios.get(`${API}/health`);

// Watch Party API calls
export const watchPartyApi = {
  list: () => axios.get(`${API}/watch-party/list`),
  
  create: (mediaId, mediaTitle, mediaType = 'movie') =>
    axios.post(`${API}/watch-party/create`, null, { 
      params: { media_id: mediaId, media_title: mediaTitle, media_type: mediaType } 
    }),
  
  get: (partyCode) => axios.get(`${API}/watch-party/${partyCode}`),
  
  // WebSocket URL builder
  getWebSocketUrl: (partyCode) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = process.env.REACT_APP_BACKEND_URL.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${backendHost}/ws/party/${partyCode}`;
  },
};

// Subtitle API calls
export const subtitleApi = {
  searchTV: (showName, season, episode, languages = 'en') =>
    axios.get(`${API}/subtitles/search/tv`, { 
      params: { show_name: showName, season, episode, languages } 
    }),
  
  searchMovie: (movieName, year = null, imdbId = null, languages = 'en') =>
    axios.get(`${API}/subtitles/search/movie`, { 
      params: { movie_name: movieName, year, imdb_id: imdbId, languages } 
    }),
  
  download: (downloadUrl, source, mediaId) =>
    axios.post(`${API}/subtitles/download`, null, { 
      params: { download_url: downloadUrl, source, media_id: mediaId } 
    }),
  
  getSettings: () => axios.get(`${API}/subtitles/settings`),
  
  updateSettings: (settings) => axios.put(`${API}/subtitles/settings`, settings),
};

// Gelatin (External Access) API calls
export const gelatinApi = {
  status: () => axios.get(`${API}/gelatin/status`),
  
  getLanUrl: () => axios.get(`${API}/gelatin/lan-url`),
  
  createTunnel: (provider = 'built_in') =>
    axios.post(`${API}/gelatin/tunnel/create`, null, { params: { provider } }),
  
  listTunnels: () => axios.get(`${API}/gelatin/tunnels`),
  
  closeTunnel: (tunnelId) => axios.delete(`${API}/gelatin/tunnel/${tunnelId}`),
  
  generateAccessToken: (permissions = 'view,watch_party', expiresHours = 24) =>
    axios.post(`${API}/gelatin/access-token`, null, { 
      params: { permissions, expires_hours: expiresHours } 
    }),
  
  getShareLink: (partyCode, useExternal = false) =>
    axios.get(`${API}/gelatin/share-link`, { params: { party_code: partyCode, use_external: useExternal } }),
  
  discoverServers: (timeout = 3.0) =>
    axios.get(`${API}/gelatin/discover`, { params: { timeout } }),
};

// Streaming Logins API calls
export const streamingLoginsApi = {
  getServices: () => axios.get(`${API}/streaming-logins/services`),
  
  getLogins: () => axios.get(`${API}/streaming-logins`),
  
  addLogin: (serviceId, email, password) =>
    axios.post(`${API}/streaming-logins`, null, { 
      params: { service_id: serviceId, email, password } 
    }),
  
  deleteLogin: (serviceId) => axios.delete(`${API}/streaming-logins/${serviceId}`),
  
  getCredentials: (serviceId) => axios.get(`${API}/streaming-logins/${serviceId}/credentials`),
};
