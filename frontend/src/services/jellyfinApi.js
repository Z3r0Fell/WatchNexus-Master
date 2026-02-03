import axios from 'axios';

// Jellyfin server runs on port 8096 internally
// We'll proxy through our backend for external access
const JELLYFIN_API = '/api/jellyfin';

// Create axios instance for Jellyfin with auth header
const jellyfinClient = axios.create();

// Set auth token for Jellyfin requests
export const setJellyfinAuth = (token, userId) => {
  const authHeader = `MediaBrowser Client="WatchNexus", Device="Web", DeviceId="watchnexus-web", Version="1.0.0", Token="${token}"`;
  jellyfinClient.defaults.headers.common['X-Emby-Authorization'] = authHeader;
  jellyfinClient.defaults.headers.common['X-Emby-Token'] = token;
};

// Jellyfin Authentication
export const jellyfinAuth = {
  // Get public server info
  getPublicInfo: () =>
    axios.get(`${JELLYFIN_API}/System/Info/Public`),
  
  // Authenticate user
  login: (username, password) =>
    axios.post(`${JELLYFIN_API}/Users/AuthenticateByName`, {
      Username: username,
      Pw: password,
    }),
  
  // Get current user
  getCurrentUser: () =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/Me`),
  
  // Logout
  logout: () =>
    jellyfinClient.post(`${JELLYFIN_API}/Sessions/Logout`),
};

// Jellyfin Library
export const jellyfinLibrary = {
  // Get all libraries (views)
  getLibraries: (userId) =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/${userId}/Views`),
  
  // Get items from a library
  getItems: (userId, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/${userId}/Items`, { params }),
  
  // Get latest items
  getLatest: (userId, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/${userId}/Items/Latest`, { params }),
  
  // Get resume items (continue watching)
  getResume: (userId, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/${userId}/Items/Resume`, { params }),
  
  // Get next up (TV shows)
  getNextUp: (userId, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Shows/NextUp`, { params: { userId, ...params } }),
  
  // Get item details
  getItem: (userId, itemId) =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/${userId}/Items/${itemId}`),
  
  // Get similar items
  getSimilar: (itemId, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Items/${itemId}/Similar`, { params }),
  
  // Search
  search: (userId, searchTerm, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/${userId}/Items`, {
      params: { searchTerm, recursive: true, ...params },
    }),
  
  // Get genres
  getGenres: (userId, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Genres`, { params: { userId, ...params } }),
  
  // Get seasons for a TV show
  getSeasons: (seriesId, userId) =>
    jellyfinClient.get(`${JELLYFIN_API}/Shows/${seriesId}/Seasons`, { params: { userId } }),
  
  // Get episodes for a season
  getEpisodes: (seriesId, seasonId, userId) =>
    jellyfinClient.get(`${JELLYFIN_API}/Shows/${seriesId}/Episodes`, { 
      params: { seasonId, userId } 
    }),
};

// Jellyfin Playback
export const jellyfinPlayback = {
  // Get playback info
  getPlaybackInfo: (itemId, userId) =>
    jellyfinClient.post(`${JELLYFIN_API}/Items/${itemId}/PlaybackInfo`, {
      UserId: userId,
      DeviceProfile: getDeviceProfile(),
    }),
  
  // Report playback start
  reportStart: (data) =>
    jellyfinClient.post(`${JELLYFIN_API}/Sessions/Playing`, data),
  
  // Report playback progress
  reportProgress: (data) =>
    jellyfinClient.post(`${JELLYFIN_API}/Sessions/Playing/Progress`, data),
  
  // Report playback stopped
  reportStopped: (data) =>
    jellyfinClient.post(`${JELLYFIN_API}/Sessions/Playing/Stopped`, data),
  
  // Mark as played
  markPlayed: (userId, itemId) =>
    jellyfinClient.post(`${JELLYFIN_API}/Users/${userId}/PlayedItems/${itemId}`),
  
  // Mark as unplayed
  markUnplayed: (userId, itemId) =>
    jellyfinClient.delete(`${JELLYFIN_API}/Users/${userId}/PlayedItems/${itemId}`),
};

// Jellyfin User Data
export const jellyfinUserData = {
  // Toggle favorite
  toggleFavorite: (userId, itemId, isFavorite) =>
    isFavorite
      ? jellyfinClient.delete(`${JELLYFIN_API}/Users/${userId}/FavoriteItems/${itemId}`)
      : jellyfinClient.post(`${JELLYFIN_API}/Users/${userId}/FavoriteItems/${itemId}`),
  
  // Get favorites
  getFavorites: (userId, params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/Users/${userId}/Items`, {
      params: { isFavorite: true, recursive: true, ...params },
    }),
};

// Jellyfin System
export const jellyfinSystem = {
  // Get server info
  getInfo: () =>
    jellyfinClient.get(`${JELLYFIN_API}/System/Info`),
  
  // Get activity log
  getActivity: (params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/System/ActivityLog/Entries`, { params }),
  
  // Get scheduled tasks
  getTasks: () =>
    jellyfinClient.get(`${JELLYFIN_API}/ScheduledTasks`),
  
  // Run task
  runTask: (taskId) =>
    jellyfinClient.post(`${JELLYFIN_API}/ScheduledTasks/Running/${taskId}`),
  
  // Restart server
  restart: () =>
    jellyfinClient.post(`${JELLYFIN_API}/System/Restart`),
  
  // Shutdown server
  shutdown: () =>
    jellyfinClient.post(`${JELLYFIN_API}/System/Shutdown`),
};

// Jellyfin Configuration
export const jellyfinConfig = {
  // Get library options
  getLibraryOptions: () =>
    jellyfinClient.get(`${JELLYFIN_API}/Library/VirtualFolders`),
  
  // Add library
  addLibrary: (name, collectionType, paths, options = {}) =>
    jellyfinClient.post(`${JELLYFIN_API}/Library/VirtualFolders`, null, {
      params: { name, collectionType, paths: paths.join(','), ...options },
    }),
  
  // Remove library
  removeLibrary: (name) =>
    jellyfinClient.delete(`${JELLYFIN_API}/Library/VirtualFolders`, {
      params: { name },
    }),
  
  // Refresh library
  refreshLibrary: () =>
    jellyfinClient.post(`${JELLYFIN_API}/Library/Refresh`),
  
  // Get plugins
  getPlugins: () =>
    jellyfinClient.get(`${JELLYFIN_API}/Plugins`),
  
  // Get available plugins
  getAvailablePlugins: () =>
    jellyfinClient.get(`${JELLYFIN_API}/Packages`),
};

// Jellyfin Live TV
export const jellyfinLiveTV = {
  // Get channels
  getChannels: (params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/LiveTv/Channels`, { params }),
  
  // Get programs (guide)
  getPrograms: (params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/LiveTv/Programs`, { params }),
  
  // Get recordings
  getRecordings: (params = {}) =>
    jellyfinClient.get(`${JELLYFIN_API}/LiveTv/Recordings`, { params }),
  
  // Get tuner hosts (IPTV sources)
  getTunerHosts: () =>
    jellyfinClient.get(`${JELLYFIN_API}/LiveTv/TunerHosts`),
  
  // Add tuner host (IPTV)
  addTunerHost: (data) =>
    jellyfinClient.post(`${JELLYFIN_API}/LiveTv/TunerHosts`, data),
  
  // Delete tuner host
  deleteTunerHost: (id) =>
    jellyfinClient.delete(`${JELLYFIN_API}/LiveTv/TunerHosts`, { params: { id } }),
  
  // Get listing providers (EPG sources)
  getListingProviders: () =>
    jellyfinClient.get(`${JELLYFIN_API}/LiveTv/ListingProviders`),
};

// Helper: Get image URL from Jellyfin
export const getJellyfinImageUrl = (itemId, imageType = 'Primary', params = {}) => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL;
  const query = new URLSearchParams({ ...params, quality: 90 }).toString();
  return `${baseUrl}/api/jellyfin/Items/${itemId}/Images/${imageType}?${query}`;
};

// Helper: Get stream URL
export const getJellyfinStreamUrl = (itemId, params = {}) => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL;
  const query = new URLSearchParams(params).toString();
  return `${baseUrl}/api/jellyfin/Videos/${itemId}/stream?${query}`;
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

export default jellyfinClient;
