import { createContext, useContext, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createApiErrorHandler } from './apiErrorHandler';

// Use REACT_APP_BACKEND_URL if set, otherwise use empty string for same-origin requests
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

/**
 * Create the base axios instance (shared)
 */
const baseApiClient = axios.create({
  baseURL: API,
  withCredentials: true,
  timeout: 30000,
});

/**
 * ApiProvider - Configures enhanced error handling on the shared axios instance
 * Wraps the app (or routes that need API calls) to provide navigation/auth context
 */
export function ApiProvider({ children }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Create error handler with current navigate/logout
  const errorHandler = useMemo(
    () => createApiErrorHandler(baseApiClient, navigate, logout),
    [navigate, logout]
  );

  // Attach/detach response interceptor
  useEffect(() => {
    const interceptorId = baseApiClient.interceptors.response.use(
      (response) => response,
      errorHandler
    );

    return () => {
      baseApiClient.interceptors.response.eject(interceptorId);
    };
  }, [errorHandler]);

  return children;
}

/**
 * Hook to get the enhanced axios instance
 * Must be used within ApiProvider
 */
export function useApiClient() {
  return baseApiClient;
}

/**
 * Re-export all API modules but using the enhanced client
 * This allows components to use the same API functions with enhanced error handling
 */

// TMDB API calls (public, no auth required) - use separate instance without auth interceptor
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

// Helper to create API functions using the enhanced client
const createApi = (client) => ({
  // Watchlist
  watchlist: {
    get: () => client.get(`/watchlist`),
    add: (item) => client.post(`/watchlist`, item),
    remove: (tmdbId) => client.delete(`/watchlist/${tmdbId}`),
  },

  // Watch progress
  progress: {
    get: () => client.get(`/watch-progress`),
    update: (progress) => client.post(`/watch-progress`, progress),
    getNextUp: () => client.get(`/next-up`),
    delete: (tmdbId, mediaType, season = null, episode = null) => {
      const params = { tmdb_id: tmdbId, media_type: mediaType };
      if (season) params.season = season;
      if (episode) params.episode = episode;
      return client.delete(`/watch-progress`, { params });
    },
    clearAll: () => client.delete(`/watch-progress/all`),
  },

  // Downloads
  downloads: {
    getAll: () => client.get(`/downloads`),
    add: (title, mediaType, tmdbId, size) =>
      client.post(`/downloads`, { title, media_type: mediaType, tmdb_id: tmdbId, size }),
    update: (downloadId, status, progress) =>
      client.patch(`/downloads/${downloadId}`, { status, progress }),
    delete: (downloadId) => client.delete(`/downloads/${downloadId}`),
  },

  // Settings
  settings: {
    get: () => client.get(`/settings`),
    update: (settings) => client.put(`/settings`, settings),
  },

  // Indexers
  indexers: {
    getAll: () => client.get(`/indexers`),
    add: (indexer) => client.post(`/indexers`, indexer),
    update: (indexerId, indexer) => client.put(`/indexers/${indexerId}`, indexer),
  },

  // Streaming services
  streaming: {
    getAll: () => client.get(`/streaming-services`),
    update: (serviceId, enabled, username) =>
      client.put(`/streaming-services/${serviceId}`, { enabled, username }),
  },

  // Library
  library: {
    getAll: (mediaType) => client.get(`/library`, { params: { media_type: mediaType } }),
    add: (item) => client.post(`/library`, item),
    getRecentlyAdded: (limit = 20) => client.get(`/marmalade/media/recent`, { params: { limit } }),
  },

  // Media Health
  mediaHealth: {
    checkFile: (filePath, computeHash = false) =>
      client.post(`/media/health-check`, { file_path: filePath, compute_hash: computeHash }),
    repairFile: (filePath, outputPath = null) =>
      client.post(`/media/repair`, { file_path: filePath, output_path: outputPath }),
    scanLibrary: (directory) =>
      client.post(`/media/scan-library`, { directory }),
    getScheduledScans: () => client.get(`/media/scheduled-scans`),
    createScheduledScan: (scan) => client.post(`/media/scheduled-scans`, scan),
    updateScheduledScan: (scanId, scan) => client.put(`/media/scheduled-scans/${scanId}`, scan),
    deleteScheduledScan: (scanId) => client.delete(`/media/scheduled-scans/${scanId}`),
    runScheduledScanNow: (scanId) => client.post(`/media/scheduled-scans/${scanId}/run`),
    getNotifications: (unreadOnly = false) =>
      client.get(`/media/notifications`, { params: { unread_only: unreadOnly } }),
    markNotificationRead: (notificationId) =>
      client.put(`/media/notifications/${notificationId}/read`),
    deleteNotification: (notificationId) =>
      client.delete(`/media/notifications/${notificationId}`),
    requestRedownload: (filePath, title, mediaType = 'movie', tmdbId = null) =>
      client.post(`/media/redownload`, { file_path: filePath, title, media_type: mediaType, tmdb_id: tmdbId }),
  },

  // Auth
  auth: {
    logout: () => client.post(`/auth/logout`),
    getMe: () => client.get(`/auth/me`),
  },

  // Compote
  compote: {
    getIndexers: () => client.get(`/compote/indexers`),
    getIndexerTypes: () => client.get(`/compote/indexer-types`),
    getSetupGuide: () => client.get(`/compote/setup-guide`),
    getDefaultIndexers: () => client.get(`/compote/default-indexers`),
    addIndexer: (name, type, url, apiKey = '', enabled = true, priority = 50, options = {}) =>
      client.post(`/compote/indexers`, {
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
    updateIndexer: (indexerId, updates) => client.put(`/compote/indexers/${indexerId}`, updates),
    removeIndexer: (indexerId) => client.delete(`/compote/indexers/${indexerId}`),
    testIndexer: (indexerId) => client.post(`/compote/indexers/${indexerId}/test`),
    search: (query, mediaType = 'movies', sortBy = 'seeders', limit = 50) =>
      client.get(`/compote/search`, {
        params: { query, media_type: mediaType, sort_by: sortBy, limit: Math.min(limit, 200) }
      }),
    grab: (title, downloadUrl = null, magnetUrl = null, size = 0, useBuiltin = true) =>
      client.post(`/compote/grab`, null, {
        params: { title, download_url: downloadUrl, magnet_url: magnetUrl, size, use_builtin: useBuiltin }
      }),
  },

  // qBittorrent
  qbittorrent: {
    getStatus: () => client.get(`/qbittorrent/status`),
    getTorrents: (filter = 'all', category = '', limit = 50) =>
      client.get(`/qbittorrent/torrents`, { params: { filter, category, limit } }),
    addTorrent: (url = null, magnet = null, savePath = '', category = 'watchnexus') =>
      client.post(`/qbittorrent/add`, null, { params: { url, magnet, save_path: savePath, category } }),
    pauseTorrent: (hash) => client.post(`/qbittorrent/pause/${hash}`),
    resumeTorrent: (hash) => client.post(`/qbittorrent/resume/${hash}`),
    deleteTorrent: (hash, deleteFiles = false) =>
      client.delete(`/qbittorrent/delete/${hash}`, { params: { delete_files: deleteFiles } }),
    getFiles: (hash) => client.get(`/qbittorrent/files/${hash}`),
    testConnection: (host, port, username, password) =>
      client.post(`/qbittorrent/test`, { host, port, username, password }),
    getConfig: () => client.get(`/qbittorrent/config`),
    saveConfig: (host, port, username, password) =>
      client.put(`/qbittorrent/config`, { host, port, username, password }),
  },

  // Torrent Engine
  torrentEngine: {
    getStatus: () => client.get(`/downloads/engine/status`),
    getTorrents: () => client.get(`/downloads/engine/torrents`),
    addTorrent: (magnet, savePath = '', sequential = false, category = 'watchnexus') =>
      client.post(`/downloads/engine/add`, null, { params: { magnet, save_path: savePath, sequential, category } }),
    getTorrent: (torrentId) => client.get(`/downloads/engine/${torrentId}`),
    getFiles: (torrentId) => client.get(`/downloads/engine/${torrentId}/files`),
    pauseTorrent: (torrentId) => client.post(`/downloads/engine/${torrentId}/pause`),
    resumeTorrent: (torrentId) => client.post(`/downloads/engine/${torrentId}/resume`),
    removeTorrent: (torrentId, deleteFiles = false) =>
      client.delete(`/downloads/engine/${torrentId}`, { params: { delete_files: deleteFiles } }),
    setSequential: (torrentId, enabled = true) =>
      client.post(`/downloads/engine/${torrentId}/sequential`, null, { params: { enabled } }),
    getSettings: () => client.get(`/downloads/engine/settings`),
    updateSettings: (settings) => client.put(`/downloads/engine/settings`, settings),
    pauseAll: () => client.post(`/downloads/engine/pause-all`),
    resumeAll: () => client.post(`/downloads/engine/resume-all`),
    removeCompleted: (deleteFiles = false) =>
      client.post(`/downloads/engine/remove-completed`, null, { params: { delete_files: deleteFiles } }),
  },

  // Health
  health: {
    check: () => client.get(`/health`),
  },

  // Subtitles
  subtitles: {
    searchTV: (showName, season, episode, languages = 'en') =>
      client.get(`/subtitles/search/tv`, { params: { show_name: showName, season, episode, languages } }),
    searchMovie: (movieName, year = null, imdbId = null, languages = 'en') =>
      client.get(`/subtitles/search/movie`, { params: { movie_name: movieName, year, imdb_id: imdbId, languages } }),
    download: (downloadUrl, source, mediaId) =>
      client.post(`/subtitles/download`, null, { params: { download_url: downloadUrl, source, media_id: mediaId } }),
    getSettings: () => client.get(`/subtitles/settings`),
    updateSettings: (settings) => client.put(`/subtitles/settings`, settings),
  },

  // Gelatin
  gelatin: {
    status: () => client.get(`/gelatin/status`),
    getLanUrl: () => client.get(`/gelatin/lan-url`),
    createTunnel: (provider = 'built_in') =>
      client.post(`/gelatin/tunnel/create`, null, { params: { provider } }),
    listTunnels: () => client.get(`/gelatin/tunnels`),
    closeTunnel: (tunnelId) => client.delete(`/gelatin/tunnel/${tunnelId}`),
    generateAccessToken: (permissions = 'view,watch_party') => {
      const allowed = ['view', 'watch_party', 'admin'];
      const requested = typeof permissions === 'string' ? permissions.split(',').map(p => p.trim()).filter(Boolean) : [permissions];
      const invalid = requested.filter(p => !allowed.includes(p));
      if (invalid.length > 0) {
        return Promise.reject(new Error(`Invalid permissions specified: ${invalid.join(', ')}`));
      }
      return client.post(`/gelatin/access-token`, null, { params: { permissions: requested.join(',') } });
    },
    getShareLink: (partyCode, useExternal = false) =>
      client.get(`/gelatin/share-link`, { params: { party_code: partyCode, use_external: useExternal } }),
    discoverServers: (timeout = 3.0) =>
      client.get(`/gelatin/discover`, { params: { timeout } }),
  },

  // Streaming Logins
  streamingLogins: {
    getServices: () => client.get(`/streaming-logins/services`),
    getLogins: () => client.get(`/streaming-logins`),
    addLogin: (serviceId, email, password) =>
      client.post(`/streaming-logins`, { service_id: serviceId, email, password }),
    deleteLogin: (serviceId) => client.delete(`/streaming-logins/${serviceId}`),
    getCredentials: (serviceId) => client.get(`/streaming-logins/${serviceId}/credentials`),
  },
});

// Export the API object creator - components use useApiClient() to get enhanced client
export const createApiClient = createApi;