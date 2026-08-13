import axios from 'axios';
import { API_URL } from '../lib/config';

const API = API_URL;

// Centralized axios instance for authenticated API calls
const apiClient = axios.create({
  baseURL: API,
  withCredentials: true,
  timeout: 30000,
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

// Security API
export const securityApi = {
  getStats: () => apiClient.get(`/security/stats`),
  
  // Audit logs
  getAuditLogs: (page = 1, pageSize = 50, action = null, userId = null) => {
    const params = { page, page_size: pageSize };
    if (action) params.action = action;
    if (userId) params.user_id = userId;
    return apiClient.get(`/security/audit`, { params });
  },
  
  // IP Rules
  getIpRules: () => apiClient.get(`/security/ip-rules`),
  addIpRule: (rule) => apiClient.post(`/security/ip-rules`, rule),
  deleteIpRule: (id) => apiClient.delete(`/security/ip-rules/${id}`),
  
  // API Keys
  getApiKeys: () => apiClient.get(`/security/api-keys`),
  createApiKey: (data) => apiClient.post(`/security/api-keys`, data),
  revokeApiKey: (id) => apiClient.delete(`/security/api-keys/${id}`),
  
  // Sessions
  getSessions: () => apiClient.get(`/security/sessions`),
  revokeSession: (id) => apiClient.post(`/security/sessions/${id}/revoke`),
};

// VPN API
export const vpnApi = {
  // Server
  getServerConfig: () => apiClient.get(`/vpn/server`),
  setupServer: (config) => apiClient.post(`/vpn/server/setup`, config),
  updateServer: (config) => apiClient.put(`/vpn/server`, config),
  activateServer: () => apiClient.post(`/vpn/server/activate`),
  deactivateServer: () => apiClient.post(`/vpn/server/deactivate`),
  
  // Peers
  getPeers: () => apiClient.get(`/vpn/peers`),
  getPeer: (id) => apiClient.get(`/vpn/peers/${id}`),
  createPeer: (data) => apiClient.post(`/vpn/peers`, data),
  updatePeer: (id, data) => apiClient.put(`/vpn/peers/${id}`, data),
  deletePeer: (id) => apiClient.delete(`/vpn/peers/${id}`),
  togglePeer: (id) => apiClient.post(`/vpn/peers/${id}/toggle`),
  getPeerQr: (id) => apiClient.get(`/vpn/peers/${id}/qr-data`),
  
  // WireGuard control
  wgUp: () => apiClient.post(`/vpn/server/wg-up`),
  wgDown: () => apiClient.post(`/vpn/server/wg-down`),
  wgStatus: () => apiClient.get(`/vpn/server/wg-status`),
  
  // Logs & Stats
  getConnectionLogs: (page = 1, pageSize = 50) =>
    apiClient.get(`/vpn/logs`, { params: { page, page_size: pageSize } }),
  getStats: () => apiClient.get(`/vpn/stats`),
};

// System info
export const systemApi = {
  getHealth: () => apiClient.get(`/health`),
  getInfo: () => apiClient.get(`/info`),
};

// Libraries (Marmalade) - using bridge routes
export const libraryApi = {
  getAll: () => apiClient.get(`/libraries`),
  getById: (id) => apiClient.get(`/libraries/${id}`),
  create: (data) => apiClient.post(`/libraries`, data),
  update: (id, data) => apiClient.put(`/libraries/${id}`, data),
  remove: (id) => apiClient.delete(`/libraries/${id}`),
  scan: (id) => apiClient.post(`/libraries/${id}/scan`),
  getMedia: (libraryId, mediaType, limit, offset) =>
    apiClient.get(`/marmalade/media`, { params: { library_id: libraryId, media_type: mediaType, limit, offset } }),
  refreshMetadata: (id) => apiClient.post(`/marmalade/libraries/${id}/refresh-metadata`),
};

// Downloads (Fondue)
export const downloadApi = {
  getAll: (status) => apiClient.get(`/downloads`, { params: status ? { status } : {} }),
  getById: (id) => apiClient.get(`/downloads/engine/${id}`),
  create: (data) => apiClient.post(`/downloads`, data),
  pause: (id) => apiClient.post(`/downloads/engine/${id}/pause`),
  resume: (id) => apiClient.post(`/downloads/engine/${id}/resume`),
  remove: (id, deleteFiles) => apiClient.delete(`/downloads/engine/${id}`, { params: { delete_files: deleteFiles } }),
  getStats: () => apiClient.get(`/downloads/engine/status`),
};

// Logs (Zest)
export const logsApi = {
  getFiles: () => apiClient.get(`/logs`),
  getLatest: (lines = 100, level) => apiClient.get(`/logs/latest`, { params: { lines, level } }),
  getFile: (filename, offset, limit) => apiClient.get(`/logs/file/${filename}`, { params: { offset, limit } }),
  getSystem: () => apiClient.get(`/logs/system`),
  deleteFile: (filename) => apiClient.delete(`/logs/file/${filename}`),
};

// Settings
export const settingsApi = {
  getAll: () => apiClient.get(`/settings`),
  get: (key) => apiClient.get(`/settings/${key}`),
  set: (key, value, global_) => apiClient.put(`/settings/${key}`, { value, global: global_ }),
  remove: (key) => apiClient.delete(`/settings/${key}`),
  bulkSet: (settings) => apiClient.post(`/settings/bulk`, settings),
};

// Integration Settings (TMDB, qBittorrent)
export const integrationApi = {
  getAll: () => apiClient.get(`/settings/integrations`),
  updateTmdb: (apiKey) => apiClient.put(`/settings/integrations/tmdb`, { api_key: apiKey }),
  updateQbit: (settings) => apiClient.put(`/settings/integrations/qbittorrent`, settings),
  testQbit: (settings) => apiClient.post(`/settings/integrations/qbittorrent/test`, settings),
};
