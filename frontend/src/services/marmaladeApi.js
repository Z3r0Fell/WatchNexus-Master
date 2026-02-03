import axios from 'axios';

// Marmalade Media Server runs on port 8096 internally
// We proxy through our backend for external access
const MARMALADE_API = '/api/marmalade';

// Create axios instance for Marmalade with auth header
const marmaladeClient = axios.create();

// Set auth token for Marmalade requests
export const setMarmaladeAuth = (token, userId) => {
  const authHeader = `MediaBrowser Client="WatchNexus", Device="Web", DeviceId="watchnexus-web", Version="1.0.0", Token="${token}"`;
  marmaladeClient.defaults.headers.common['X-Emby-Authorization'] = authHeader;
  marmaladeClient.defaults.headers.common['X-Emby-Token'] = token;
};

// Marmalade Authentication
export const marmaladeAuth = {
  // Get public server info
  getPublicInfo: () =>
    axios.get(`${MARMALADE_API}/System/Info/Public`),
  
  // Authenticate user
  login: (username, password) =>
    axios.post(`${MARMALADE_API}/Users/AuthenticateByName`, {
      Username: username,
      Pw: password,
    }),
  
  // Get current user
  getCurrentUser: () =>
    marmaladeClient.get(`${MARMALADE_API}/Users/Me`),
  
  // Logout
  logout: () =>
    marmaladeClient.post(`${MARMALADE_API}/Sessions/Logout`),
};

// Marmalade Library
export const marmaladeLibrary = {
  // Get all libraries (views)
  getLibraries: (userId) =>
    marmaladeClient.get(`${MARMALADE_API}/Users/${userId}/Views`),
  
  // Get items from a library
  getItems: (userId, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Users/${userId}/Items`, { params }),
  
  // Get latest items
  getLatest: (userId, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Users/${userId}/Items/Latest`, { params }),
  
  // Get resume items (continue watching)
  getResume: (userId, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Users/${userId}/Items/Resume`, { params }),
  
  // Get next up (TV shows)
  getNextUp: (userId, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Shows/NextUp`, { params: { userId, ...params } }),
  
  // Get item details
  getItem: (userId, itemId) =>
    marmaladeClient.get(`${MARMALADE_API}/Users/${userId}/Items/${itemId}`),
  
  // Get similar items
  getSimilar: (itemId, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Items/${itemId}/Similar`, { params }),
  
  // Search
  search: (userId, searchTerm, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Users/${userId}/Items`, {
      params: { searchTerm, recursive: true, ...params },
    }),
  
  // Get genres
  getGenres: (userId, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Genres`, { params: { userId, ...params } }),
  
  // Get seasons for a TV show
  getSeasons: (seriesId, userId) =>
    marmaladeClient.get(`${MARMALADE_API}/Shows/${seriesId}/Seasons`, { params: { userId } }),
  
  // Get episodes for a season
  getEpisodes: (seriesId, seasonId, userId) =>
    marmaladeClient.get(`${MARMALADE_API}/Shows/${seriesId}/Episodes`, { 
      params: { seasonId, userId } 
    }),
};

// Marmalade Playback
export const marmaladePlayback = {
  // Get playback info
  getPlaybackInfo: (itemId, userId) =>
    marmaladeClient.post(`${MARMALADE_API}/Items/${itemId}/PlaybackInfo`, {
      UserId: userId,
      DeviceProfile: getDeviceProfile(),
    }),
  
  // Report playback start
  reportStart: (data) =>
    marmaladeClient.post(`${MARMALADE_API}/Sessions/Playing`, data),
  
  // Report playback progress
  reportProgress: (data) =>
    marmaladeClient.post(`${MARMALADE_API}/Sessions/Playing/Progress`, data),
  
  // Report playback stopped
  reportStopped: (data) =>
    marmaladeClient.post(`${MARMALADE_API}/Sessions/Playing/Stopped`, data),
  
  // Mark as played
  markPlayed: (userId, itemId) =>
    marmaladeClient.post(`${MARMALADE_API}/Users/${userId}/PlayedItems/${itemId}`),
  
  // Mark as unplayed
  markUnplayed: (userId, itemId) =>
    marmaladeClient.delete(`${MARMALADE_API}/Users/${userId}/PlayedItems/${itemId}`),
};

// Marmalade User Data
export const marmaladeUserData = {
  // Toggle favorite
  toggleFavorite: (userId, itemId, isFavorite) =>
    isFavorite
      ? marmaladeClient.delete(`${MARMALADE_API}/Users/${userId}/FavoriteItems/${itemId}`)
      : marmaladeClient.post(`${MARMALADE_API}/Users/${userId}/FavoriteItems/${itemId}`),
  
  // Get favorites
  getFavorites: (userId, params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/Users/${userId}/Items`, {
      params: { isFavorite: true, recursive: true, ...params },
    }),
};

// Marmalade System
export const marmaladeSystem = {
  // Get server info
  getInfo: () =>
    marmaladeClient.get(`${MARMALADE_API}/System/Info`),
  
  // Get activity log
  getActivity: (params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/System/ActivityLog/Entries`, { params }),
  
  // Get scheduled tasks
  getTasks: () =>
    marmaladeClient.get(`${MARMALADE_API}/ScheduledTasks`),
  
  // Run task
  runTask: (taskId) =>
    marmaladeClient.post(`${MARMALADE_API}/ScheduledTasks/Running/${taskId}`),
  
  // Restart server
  restart: () =>
    marmaladeClient.post(`${MARMALADE_API}/System/Restart`),
  
  // Shutdown server
  shutdown: () =>
    marmaladeClient.post(`${MARMALADE_API}/System/Shutdown`),
};

// Marmalade Configuration
export const marmaladeConfig = {
  // Get library options
  getLibraryOptions: () =>
    marmaladeClient.get(`${MARMALADE_API}/Library/VirtualFolders`),
  
  // Add library
  addLibrary: (name, collectionType, paths, options = {}) =>
    marmaladeClient.post(`${MARMALADE_API}/Library/VirtualFolders`, null, {
      params: { name, collectionType, paths: paths.join(','), ...options },
    }),
  
  // Remove library
  removeLibrary: (name) =>
    marmaladeClient.delete(`${MARMALADE_API}/Library/VirtualFolders`, {
      params: { name },
    }),
  
  // Refresh library
  refreshLibrary: () =>
    marmaladeClient.post(`${MARMALADE_API}/Library/Refresh`),
  
  // Get plugins
  getPlugins: () =>
    marmaladeClient.get(`${MARMALADE_API}/Plugins`),
  
  // Get available plugins
  getAvailablePlugins: () =>
    marmaladeClient.get(`${MARMALADE_API}/Packages`),
};

// Marmalade Live TV
export const marmaladeLiveTV = {
  // Get channels
  getChannels: (params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/LiveTv/Channels`, { params }),
  
  // Get programs (guide)
  getPrograms: (params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/LiveTv/Programs`, { params }),
  
  // Get recordings
  getRecordings: (params = {}) =>
    marmaladeClient.get(`${MARMALADE_API}/LiveTv/Recordings`, { params }),
  
  // Get tuner hosts (IPTV sources)
  getTunerHosts: () =>
    marmaladeClient.get(`${MARMALADE_API}/LiveTv/TunerHosts`),
  
  // Add tuner host (IPTV)
  addTunerHost: (data) =>
    marmaladeClient.post(`${MARMALADE_API}/LiveTv/TunerHosts`, data),
  
  // Delete tuner host
  deleteTunerHost: (id) =>
    marmaladeClient.delete(`${MARMALADE_API}/LiveTv/TunerHosts`, { params: { id } }),
  
  // Get listing providers (EPG sources)
  getListingProviders: () =>
    marmaladeClient.get(`${MARMALADE_API}/LiveTv/ListingProviders`),
};

// Helper: Get image URL from Marmalade
export const getMarmaladeImageUrl = (itemId, imageType = 'Primary', params = {}) => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL;
  const query = new URLSearchParams({ ...params, quality: 90 }).toString();
  return `${baseUrl}/api/marmalade/Items/${itemId}/Images/${imageType}?${query}`;
};

// Helper: Get stream URL
export const getMarmaladeStreamUrl = (itemId, params = {}) => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL;
  const query = new URLSearchParams(params).toString();
  return `${baseUrl}/api/marmalade/Videos/${itemId}/stream?${query}`;
};

// Device profile for playback
const getDeviceProfile = () => ({
  MaxStreamingBitrate: 120000000,
  MaxStaticBitrate: 100000000,
  MusicStreamingTranscodingBitrate: 384000,
  DirectPlayProfiles: [
    { Container: 'webm', Type: 'Video', VideoCodec: 'vp8,vp9,av1', AudioCodec: 'vorbis,opus' },
    { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,h265,hevc,vp9,av1', AudioCodec: 'aac,mp3,opus,flac,vorbis' },
    { Container: 'mkv', Type: 'Video', VideoCodec: 'h264,h265,hevc,vp9,av1', AudioCodec: 'aac,mp3,opus,flac,vorbis' },
    { Container: 'mp3', Type: 'Audio' },
    { Container: 'aac', Type: 'Audio' },
    { Container: 'flac', Type: 'Audio' },
    { Container: 'webm', Type: 'Audio', AudioCodec: 'vorbis,opus' },
  ],
  TranscodingProfiles: [
    { Container: 'ts', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3' },
    { Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3' },
  ],
});

export default marmaladeClient;
