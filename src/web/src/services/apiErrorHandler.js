import { toast } from '../components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Centralized API error handling with user-friendly messages and retry logic.
 * Handles: 401→logout, 403→upgrade, 429→retry, 503→retry with backoff
 */

// Track retry attempts per request to avoid infinite loops
const retryCounts = new Map();
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 1s, 3s exponential backoff

// Error code to user message mapping
const ERROR_MESSAGES = {
  // Auth
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You don\'t have permission to access this resource.',
  
  // Tier/license
  FORTRESS_TIER_LOCKED: (data) => `This feature requires a ${data?.required_tier || 'Pro/Ultra'} license.`,
  
  // Validation
  INVALID_REQUEST: 'Invalid request. Please check your input.',
  CONFLICT: 'This item already exists.',
  INVALID_REFERENCE: 'Referenced item does not exist.',
  
  // Not found
  NOT_FOUND: 'The requested resource was not found.',
  
  // Rate limiting
  RATE_LIMITED: (data) => `Too many requests. Please wait ${data?.retry_after || 'a moment'} and try again.`,
  
  // Server/External
  SERVICE_UNAVAILABLE: 'A required service is temporarily unavailable. Please try again in a moment.',
  UPSTREAM_TIMEOUT: 'An external service timed out. Please try again.',
  DATABASE_BUSY: 'The database is busy. Please try again in a moment.',
  DATABASE_READONLY: 'Database is read-only. Contact your administrator.',
  TIMEOUT: 'The request timed out. Please try again.',
  
  // Network
  NETWORK_ERROR: 'Network error. Please check your connection.',
  CONNECTION_REFUSED: 'Unable to connect to the server. Is it running?',
  
  // Generic
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again or contact support.',
  NOT_IMPLEMENTED: 'This feature is not yet implemented.',
};

/**
 * Extract user-friendly message from API error response
 */
export function getErrorMessage(error) {
  // Axios error with response
  if (error.response?.data) {
    const data = error.response.data;
    const status = error.response.status;
    
    // Backend returns { error: "CODE", message: "..." } format
    if (data.error && ERROR_MESSAGES[data.error]) {
      const msg = ERROR_MESSAGES[data.error];
      return typeof msg === 'function' ? msg(data) : msg;
    }
    
    // Backend returns { detail: "..." } or { message: "..." }
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    
    // Fallback by status code
    return getStatusMessage(status, data);
  }
  
  // Network/timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return ERROR_MESSAGES.TIMEOUT;
  }
  if (!error.response) {
    if (error.message?.includes('Network Error') || error.message?.includes('Failed to fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (error.message?.includes('ECONNREFUSED')) {
      return ERROR_MESSAGES.CONNECTION_REFUSED;
    }
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  // Fallback
  return ERROR_MESSAGES.INTERNAL_ERROR;
}

function getStatusMessage(status, data) {
  switch (status) {
    case 401: return ERROR_MESSAGES.UNAUTHORIZED;
    case 403: return data?.error === 'FORTRESS_TIER_LOCKED' 
      ? ERROR_MESSAGES.FORTRESS_TIER_LOCKED(data) 
      : ERROR_MESSAGES.FORBIDDEN;
    case 404: return ERROR_MESSAGES.NOT_FOUND;
    case 409: return ERROR_MESSAGES.CONFLICT;
    case 422: return data?.detail || 'Validation failed. Please check your input.';
    case 429: return ERROR_MESSAGES.RATE_LIMITED(data);
    case 503: return ERROR_MESSAGES.SERVICE_UNAVAILABLE;
    case 504: return ERROR_MESSAGES.UPSTREAM_TIMEOUT;
    default: return ERROR_MESSAGES.INTERNAL_ERROR;
  }
}

/**
 * Determine if request should be retried automatically
 */
export function shouldRetry(error) {
  if (!error.response) return true; // Network errors - retry
  
  const status = error.response.status;
  // Retry on 429, 503, 504
  return [429, 503, 504].includes(status);
}

/**
 * Get retry delay for attempt number
 */
export function getRetryDelay(attempt) {
  return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)] || 5000;
}

/**
 * Create a unique key for tracking retries per request
 */
function getRetryKey(config) {
  return `${config.method?.toUpperCase()}:${config.url}`;
}

/**
 * Check if we've exceeded max retries for this request
 */
export function canRetry(config) {
  const key = getRetryKey(config);
  const count = retryCounts.get(key) || 0;
  return count < MAX_RETRIES;
}

/**
 * Increment retry count
 */
export function incrementRetry(config) {
  const key = getRetryKey(config);
  retryCounts.set(key, (retryCounts.get(key) || 0) + 1);
}

/**
 * Clear retry count (call on success)
 */
export function clearRetry(config) {
  const key = getRetryKey(config);
  retryCounts.delete(key);
}

/**
 * Handle 401 - logout and redirect
 */
export function handleUnauthorized(navigate, logout) {
  toast.error('Session expired', {
    description: 'Please log in again to continue.',
    duration: 5000,
  });
  logout();
  navigate('/login', { replace: true });
}

/**
 * Handle 403 - tier locked or forbidden
 */
export function handleForbidden(error, navigate) {
  const data = error.response?.data;
  
  if (data?.error === 'FORTRESS_TIER_LOCKED') {
    // Tier-locked feature - show upgrade prompt
    toast.error('Feature requires upgrade', {
      description: `This feature requires a ${data.required_tier || 'Pro/Ultra'} license.`,
      duration: 8000,
      action: {
        label: 'Upgrade',
        onClick: () => navigate('/settings?section=activation'),
      },
    });
    return;
  }
  
  // Generic forbidden
  toast.error('Access denied', {
    description: data?.message || ERROR_MESSAGES.FORBIDDEN,
    duration: 5000,
  });
}

/**
 * Handle 429 - rate limited
 */
export function handleRateLimited(error) {
  const data = error.response?.data;
  const retryAfter = data?.retry_after || data?.retryAfter || 60;
  
  toast.error('Rate limited', {
    description: `Too many requests. Please wait ${retryAfter}s and try again.`,
    duration: retryAfter * 1000,
  });
}

/**
 * Handle 503/504 - service unavailable with auto-retry
 */
export async function handleServiceUnavailable(error, originalRequest, apiClient) {
  const key = getRetryKey(originalRequest);
  const attempt = retryCounts.get(key) || 0;
  
  if (attempt >= MAX_RETRIES) {
    toast.error('Service unavailable', {
      description: 'The service is still unavailable after several retries. Please try again later.',
      duration: 10000,
    });
    throw error;
  }
  
  incrementRetry(originalRequest);
  const delay = getRetryDelay(attempt);
  
  toast.loading(`Retrying in ${Math.ceil(delay/1000)}s...`, { id: key, duration: delay + 1000 });
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    const response = await apiClient(originalRequest);
    clearRetry(originalRequest);
    toast.dismiss(key);
    return response;
  } catch (retryError) {
    toast.dismiss(key);
    throw retryError;
  }
}

/**
 * Main error handler for axios interceptor
 * Returns a promise that either resolves with retry response or rejects with user-friendly error
 */
export function createApiErrorHandler(apiClient, navigate, logout) {
  return async (error) => {
    // Don't handle cancellation
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    
    const originalRequest = error.config;
    
    // 401 - Unauthorized
    if (error.response?.status === 401) {
      handleUnauthorized(navigate, logout);
      return Promise.reject(new Error(ERROR_MESSAGES.UNAUTHORIZED));
    }
    
    // 403 - Forbidden / Tier locked
    if (error.response?.status === 403) {
      handleForbidden(error, navigate);
      return Promise.reject(new Error(getErrorMessage(error)));
    }
    
    // 429 - Rate limited
    if (error.response?.status === 429) {
      handleRateLimited(error);
      // Could auto-retry after retry-after header
      const retryAfter = error.response.headers?.['retry-after'];
      if (retryAfter && canRetry(originalRequest)) {
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
        incrementRetry(originalRequest);
        return apiClient(originalRequest);
      }
      return Promise.reject(new Error(getErrorMessage(error)));
    }
    
    // 503/504 - Service unavailable with auto-retry
    if ([503, 504].includes(error.response?.status) && canRetry(originalRequest)) {
      return handleServiceUnavailable(error, originalRequest, apiClient);
    }
    
    // All other errors - show toast and reject
    const message = getErrorMessage(error);
    
    // Don't toast for expected validation errors (400, 422) if caller handles inline
    const isValidationError = [400, 422].includes(error.response?.status);
    if (!isValidationError && !originalRequest?.skipErrorToast) {
      toast.error('Request failed', {
        description: message,
        duration: 6000,
      });
    }
    
    // Attach correlation ID if present
    const correlationId = error.response?.headers?.['x-correlation-id'];
    const enhancedError = new Error(message);
    enhancedError.originalError = error;
    enhancedError.status = error.response?.status;
    enhancedError.correlationId = correlationId;
    enhancedError.isValidationError = isValidationError;
    
    return Promise.reject(enhancedError);
  };
}

/**
 * React hook to get error handler with navigation and auth context
 */
export function useApiErrorHandler(apiClient) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  // Memoize the handler
  const handler = React.useMemo(
    () => createApiErrorHandler(apiClient, navigate, logout),
    [apiClient, navigate, logout]
  );
  
  return handler;
}

// Need to import React for useMemo
import React from 'react';