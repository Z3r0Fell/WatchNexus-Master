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

// TMDB image base URL — single source of truth for poster/backdrop sizes.
// Keeps the CDN host out of individual components and centralizes the
// image width policy. Accepts a named size (small/medium/large) or an exact
// TMDB width token (e.g. 'w154', 'w500') to preserve per-component intent.
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_IMAGE_WIDTHS = { small: 'w92', medium: 'w342', large: 'w1280' };

export const tmdbImageUrl = (path, size = 'medium') => {
  if (!path) return null;
  const width = TMDB_IMAGE_WIDTHS[size] || size || TMDB_IMAGE_WIDTHS.medium;
  return `${TMDB_IMAGE_BASE}/${width}${path}`;
};
