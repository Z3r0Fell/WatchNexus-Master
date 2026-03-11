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
