/**
 * Application configuration
 * Handles environment-aware settings for development and production
 */

// Backend URL configuration
// - In development: Uses REACT_APP_BACKEND_URL (e.g., preview URL)
// - In production (standalone): Empty string for same-origin requests
export const BACKEND_URL = (() => {
  const raw = process.env.REACT_APP_BACKEND_URL || '';
  if (!raw) return '';
  // Strip trailing slashes and validate protocol
  const trimmed = raw.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    console.warn(`REACT_APP_BACKEND_URL must include protocol (http:// or https://): ${raw}`);
    return '';
  }
  return trimmed;
})();

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

// TMDB image base URL — single source of truth for poster/backdrop sizes.
// image width policy. Accepts a named size (small/medium/large) or an exact
// TMDB width token (e.g. 'w154', 'w500') to preserve per-component intent.
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_IMAGE_WIDTHS = { small: 'w92', medium: 'w342', large: 'w1280' };
export const tmdbImageUrl = (path, size = 'medium') => {
  const width = TMDB_IMAGE_WIDTHS[size] || size || TMDB_IMAGE_WIDTHS.medium;
  return `${TMDB_IMAGE_BASE}/${width}${path}`;
};
