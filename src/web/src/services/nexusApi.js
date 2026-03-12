import axios from 'axios';
import { API_URL } from '../lib/config';

const API = API_URL;

// Security API
export const securityApi = {
  getStats: () => axios.get(`${API}/security/stats`),
  
  // Audit logs
  getAuditLogs: (page = 1, pageSize = 50, action = null, userId = null) => {
    const params = { page, page_size: pageSize };
    if (action) params.action = action;
    if (userId) params.user_id = userId;
    return axios.get(`${API}/security/audit`, { params });
  },
  
  // IP Rules
  getIpRules: () => axios.get(`${API}/security/ip-rules`),
  addIpRule: (rule) => axios.post(`${API}/security/ip-rules`, rule),
  deleteIpRule: (id) => axios.delete(`${API}/security/ip-rules/${id}`),
  
  // API Keys
  getApiKeys: () => axios.get(`${API}/security/api-keys`),
  createApiKey: (data) => axios.post(`${API}/security/api-keys`, data),
  revokeApiKey: (id) => axios.delete(`${API}/security/api-keys/${id}`),
  
  // Sessions
  getSessions: () => axios.get(`${API}/security/sessions`),
  revokeSession: (id) => axios.post(`${API}/security/sessions/${id}/revoke`),
};

// VPN API
export const vpnApi = {
  // Server
  getServerConfig: () => axios.get(`${API}/vpn/server`),
  setupServer: (config) => axios.post(`${API}/vpn/server/setup`, config),
  updateServer: (config) => axios.put(`${API}/vpn/server`, config),
  activateServer: () => axios.post(`${API}/vpn/server/activate`),
  deactivateServer: () => axios.post(`${API}/vpn/server/deactivate`),
  
  // Peers
  getPeers: () => axios.get(`${API}/vpn/peers`),
  getPeer: (id) => axios.get(`${API}/vpn/peers/${id}`),
  createPeer: (data) => axios.post(`${API}/vpn/peers`, data),
  updatePeer: (id, data) => axios.put(`${API}/vpn/peers/${id}`, data),
  deletePeer: (id) => axios.delete(`${API}/vpn/peers/${id}`),
  togglePeer: (id) => axios.post(`${API}/vpn/peers/${id}/toggle`),
  getPeerQr: (id) => axios.get(`${API}/vpn/peers/${id}/qr-data`),
  
  // WireGuard control
  wgUp: () => axios.post(`${API}/vpn/server/wg-up`),
  wgDown: () => axios.post(`${API}/vpn/server/wg-down`),
  wgStatus: () => axios.get(`${API}/vpn/server/wg-status`),
  
  // Logs & Stats
  getConnectionLogs: (page = 1, pageSize = 50) =>
    axios.get(`${API}/vpn/logs`, { params: { page, page_size: pageSize } }),
  getStats: () => axios.get(`${API}/vpn/stats`),
};

// System info
export const systemApi = {
  getHealth: () => axios.get(`${API}/health`),
  getInfo: () => axios.get(`${API}/info`),
};

// Libraries (Marmalade) - using bridge routes
export const libraryApi = {
  getAll: () => axios.get(`${API}/libraries`),
  getById: (id) => axios.get(`${API}/libraries/${id}`),
  create: (data) => axios.post(`${API}/libraries`, data),
  update: (id, data) => axios.put(`${API}/libraries/${id}`, data),
  remove: (id) => axios.delete(`${API}/libraries/${id}`),
  scan: (id) => axios.post(`${API}/libraries/${id}/scan`),
  getMedia: (libraryId, mediaType, limit, offset) =>
    axios.get(`${API}/marmalade/media`, { params: { library_id: libraryId, media_type: mediaType, limit, offset } }),
  refreshMetadata: (id) => axios.post(`${API}/marmalade/libraries/${id}/refresh-metadata`),
};

// Downloads (Fondue)
export const downloadApi = {
  getAll: (status) => axios.get(`${API}/downloads`, { params: status ? { status } : {} }),
  getById: (id) => axios.get(`${API}/downloads/engine/${id}`),
  create: (data) => axios.post(`${API}/downloads`, data),
  pause: (id) => axios.post(`${API}/downloads/engine/${id}/pause`),
  resume: (id) => axios.post(`${API}/downloads/engine/${id}/resume`),
  remove: (id, deleteFiles) => axios.delete(`${API}/downloads/engine/${id}`, { params: { delete_files: deleteFiles } }),
  getStats: () => axios.get(`${API}/downloads/engine/status`),
};

// Logs (Zest)
export const logsApi = {
  getFiles: () => axios.get(`${API}/logs`),
  getLatest: (lines = 100, level) => axios.get(`${API}/logs/latest`, { params: { lines, level } }),
  getFile: (filename, offset, limit) => axios.get(`${API}/logs/file/${filename}`, { params: { offset, limit } }),
  getSystem: () => axios.get(`${API}/logs/system`),
  deleteFile: (filename) => axios.delete(`${API}/logs/file/${filename}`),
};

// Settings
export const settingsApi = {
  getAll: () => axios.get(`${API}/settings`),
  get: (key) => axios.get(`${API}/settings/${key}`),
  set: (key, value, global_) => axios.put(`${API}/settings/${key}`, { value, global: global_ }),
  remove: (key) => axios.delete(`${API}/settings/${key}`),
  bulkSet: (settings) => axios.post(`${API}/settings/bulk`, settings),
};

// Integration Settings (TMDB, qBittorrent)
export const integrationApi = {
  getAll: () => axios.get(`${API}/settings/integrations`),
  updateTmdb: (apiKey) => axios.put(`${API}/settings/integrations/tmdb`, { api_key: apiKey }),
  updateQbit: (settings) => axios.put(`${API}/settings/integrations/qbittorrent`, settings),
  testQbit: (settings) => axios.post(`${API}/settings/integrations/qbittorrent/test`, settings),
};
