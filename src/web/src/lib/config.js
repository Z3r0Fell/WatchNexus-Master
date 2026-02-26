/**
 * Application configuration
 * Handles environment-aware settings for development and production
 */

// Backend URL configuration
// - In development: Uses REACT_APP_BACKEND_URL (e.g., preview URL)
// - In production (standalone): Empty string for same-origin requests
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// API base URL (includes /api prefix)
export const API_URL = `${BACKEND_URL}/api`;

// Helper to get the backend host (without protocol)
export const getBackendHost = () => {
  if (!BACKEND_URL) {
    return window.location.host;
  }
  return BACKEND_URL.replace(/^https?:\/\//, '');
};

// WebSocket URL
export const getWebSocketUrl = (path) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = getBackendHost();
  return `${protocol}//${host}${path}`;
};
